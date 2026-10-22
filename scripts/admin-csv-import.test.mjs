import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImportCsv, importColumns } from '../app/admin/(protected)/import/csv-import.ts';

const header = importColumns.join(',');
const base = 'HIST-0001,2025-03-15,"Ján; Novák",Košice,210,12,CASH,DEMONTAZ,0,INA,Robo;Mato,45,0,12,0,0';

test('čiarkový vzor ponechá bodkočiarku v mene a pracovníkov v jednom poli', () => {
  const result = parseImportCsv(`\uFEFF${header}\r\n${base}\r\n`, ['Robo', 'Mato'], '2026-10-22');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows[0].errors, []);
  assert.equal(result.rows[0].columns.length, 16);
  assert.equal(result.rows[0].job.sourceId, 'HIST-0001');
  assert.equal(result.rows[0].job.customerName, 'Ján; Novák');
  assert.deepEqual(result.rows[0].job.workerNames, ['Robo', 'Mato']);
});

test('bodkočiarkový CSV podporuje úvodzovky, desatinnú čiarku a nový riadok v poli', () => {
  const row = 'HIST-0002;2025-03-15;"Ján ""Jano""\nNovák";Košice;210,5;12;CASH;DEMONTAZ;0;INA;"Robo;Mato";45;0;12;0;0';
  const result = parseImportCsv(`${importColumns.join(';')}\r\n${row}`, ['Robo', 'Mato'], '2026-10-22');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows[0].errors, []);
  assert.equal(result.rows[0].job.customerName, 'Ján "Jano"\nNovák');
  assert.equal(result.rows[0].job.m2, 210.5);
  assert.equal(result.rows[0].line, 2);
});

test('pracovníkov páruje rovnako ako pôvodný import aj pri odlišnej diakritike', () => {
  const result = parseImportCsv(`${header}\n${base}`, ['Róbo', 'Maťo'], '2026-10-22');
  assert.deepEqual(result.rows[0].errors, []);
  assert.deepEqual(result.rows[0].job.workerNames, ['Róbo', 'Maťo']);
});

test('nejednoznačné mená zrušia celý lokálny náhľad pred odovzdaním zákaziek na zápis', () => {
  const firstWithoutWorker = base.replace('Robo;Mato', '');
  for (const workerNames of [['Robo', 'Robo', 'Mato'], ['Robo', 'Róbo', 'Mato']]) {
    const preview = parseImportCsv(`${header}\n${firstWithoutWorker}\n${base}`, workerNames, '2026-10-22');
    assert.deepEqual(preview.rows[0].errors, []);
    assert.match(preview.rows[1].errors.join(' '), /nejednoznačný pracovník: Robo/);
    assert.equal(preview.rows[1].job, undefined);
    const jobsToWrite = preview.errors.length || preview.rows.some((item) => item.errors.length)
      ? [] : preview.rows.map((item) => item.job);
    assert.equal(jobsToWrite.length, 0, 'chybný druhý riadok nesmie povoliť zápis prvého');
  }
});

test('kontroluje všetky stĺpce každého riadku a nepreskakuje neúplné dáta', () => {
  const invalid = 'HIST-0002,2025-03-15,Test,Košice,210,12,NEPLATNA,NEPLATNY,abc,NEPLATNA,Neznámy,-1,0,12,0,xy';
  const result = parseImportCsv(`${header}\n${base}\n${invalid}`, ['Robo', 'Mato'], '2026-10-22');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1].line, 3);
  assert.match(result.rows[1].errors.join(' '), /platba/);
  assert.match(result.rows[1].errors.join(' '), /typ práce/);
  assert.match(result.rows[1].errors.join(' '), /skládka/);
  assert.match(result.rows[1].errors.join(' '), /pracovník/);
  assert.match(result.rows[1].errors.join(' '), /nafta/);
  assert.match(result.rows[1].errors.join(' '), /iné náklady/);
  assert.equal(result.rows[1].job, undefined);
  const short = parseImportCsv(`${header}\nHIST-0003,2025-03-15,Test,Košice`, [], '2026-10-22');
  assert.match(short.rows[0].errors[0], /16 stĺpcov/);
});

test('odmietne nesprávnu hlavičku, neukončené úvodzovky a duplicitný riadok', () => {
  assert.ok(parseImportCsv(`datum,meno\n${base}`, [], '2026-10-22').errors.length);
  assert.match(parseImportCsv(`${header}\n"neukončené`, [], '2026-10-22').errors.join(' '), /úvodzovky/);
  const duplicate = parseImportCsv(`${header}\n${base}\n${base}`, ['Robo', 'Mato'], '2026-10-22');
  assert.match(duplicate.rows[1].errors.join(' '), /viackrát/);
  const sameDetailsDifferentIds = parseImportCsv(`${header}\n${base}\n${base.replace('HIST-0001', 'HIST-0004')}`, ['Robo', 'Mato'], '2026-10-22');
  assert.deepEqual(sameDetailsDifferentIds.rows.flatMap((row) => row.errors), []);
  const missingId = parseImportCsv(`${header}\n${base.replace('HIST-0001', '')}`, ['Robo', 'Mato'], '2026-10-22');
  assert.match(missingId.rows[0].errors.join(' '), /ID zákazky/);
  const mixedCaseId = parseImportCsv(`${header}\n${base}\n${base.replace('HIST-0001', 'hist-0001')}`, ['Robo', 'Mato'], '2026-10-22');
  assert.match(mixedCaseId.rows[1].errors.join(' '), /ID zákazky.*viackrát/);
});

test('samostatné CSV odmietnu Unicode ID, ktoré sa veľkými písmenami zmení na existujúce ASCII ID', () => {
  for (const [asciiId, unicodeId] of [['SS-1', 'ß-1'], ['I-1', 'ı-1']]) {
    const firstUpload = parseImportCsv(`${header}\n${base.replace('HIST-0001', asciiId)}`, ['Robo', 'Mato'], '2026-10-22');
    assert.deepEqual(firstUpload.rows[0].errors, []);
    assert.equal(firstUpload.rows[0].job.sourceId, asciiId);

    const secondUpload = parseImportCsv(`${header}\n${base.replace('HIST-0001', unicodeId)}`, ['Robo', 'Mato'], '2026-10-22');
    assert.match(secondUpload.rows[0].errors.join(' '), /ID zákazky/);
    assert.equal(secondUpload.rows[0].job, undefined);
  }
});
