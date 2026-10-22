import { isValidIsoCalendarDate, slovakCalendarDateAfterDays } from '@/src/lib/date-only';
import type { BusinessLandfill, BusinessPaymentType, BusinessWorkType } from '@/src/server/types';

export const importColumns = [
  'id_zakazky', 'datum', 'meno', 'lokalita', 'm2', 'cena_za_m2', 'platba', 'typ_prace', 'vaha_kg',
  'skladka', 'pracovnici', 'nafta', 'obleky', 'rukavice', 'penetrak', 'ine_naklady',
] as const;

export type ImportJob = {
  sourceId: string;
  demolitionDate: string;
  customerName: string;
  location: string;
  m2: number;
  pricePerM2: number;
  paymentType: BusinessPaymentType;
  workType: BusinessWorkType;
  wasteKg: number;
  landfill: BusinessLandfill;
  workerNames: string[];
  fuel: number;
  suits: number;
  gloves: number;
  penetrant: number;
  otherAmount: number;
};

export type ImportPreviewRow = {
  line: number;
  columns: string[];
  errors: string[];
  job?: ImportJob;
};

export type ImportPreview = { rows: ImportPreviewRow[]; errors: string[] };

export function matchesImportWorkerName(storedName: string, inputName: string) {
  return storedName.localeCompare(inputName, 'sk', { sensitivity: 'base' }) === 0;
}

type CsvRecord = { line: number; columns: string[] };

function readRecords(source: string, delimiter: ',' | ';'): CsvRecord[] {
  const records: CsvRecord[] = [];
  let line = 1;
  let recordLine = 1;
  let columns: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  let started = false;

  const finishField = () => {
    columns.push(field.trim());
    field = '';
    closed = false;
    started = false;
  };
  const finishRecord = () => {
    finishField();
    if (columns.some(Boolean)) records.push({ line: recordLine, columns });
    columns = [];
    recordLine = line + 1;
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        field += '\n';
        line += 1;
      } else field += char;
      continue;
    }
    if (char === delimiter) {
      finishField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      finishRecord();
      line += 1;
    } else if (char === '"' && !started && !closed) {
      quoted = true;
      started = true;
    } else if (char === '"' || (closed && char !== ' ' && char !== '\t')) {
      throw new Error(`Riadok ${recordLine}: neplatné úvodzovky v CSV.`);
    } else if (!closed) {
      field += char;
      started = true;
    }
  }
  if (quoted) throw new Error(`Riadok ${recordLine}: neukončené úvodzovky v CSV.`);
  if (started || closed || columns.length || field) finishRecord();
  return records;
}

function numberField(value: string, label: string, errors: string[], required = false, positive = false) {
  if (!value && !required) return 0;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
    errors.push(`${label}: zadajte nezáporné číslo s najviac 2 desatinnými miestami`);
    return 0;
  }
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed > 9_999_999_999.99 || (positive && parsed === 0)) {
    errors.push(`${label}: číslo je mimo povoleného rozsahu`);
    return 0;
  }
  return parsed;
}

export function parseImportCsv(csv: string, workerNames: string[], today = slovakCalendarDateAfterDays(0)): ImportPreview {
  const source = csv.replace(/^\uFEFF/, '');
  if (!source.trim()) return { rows: [], errors: ['Vložte CSV súbor s hlavičkou a aspoň jedným riadkom.'] };
  if (source.length > 200_000) return { rows: [], errors: ['CSV je príliš veľké. Maximálna veľkosť je 200 kB.'] };

  const candidates = ([',', ';'] as const).map((delimiter) => {
    try { return { records: readRecords(source, delimiter), error: '' }; }
    catch (error) { return { records: [] as CsvRecord[], error: (error as Error).message }; }
  });
  const matches = candidates.filter(({ records }) => records.length > 0
    && records[0].columns.length === importColumns.length
    && records[0].columns.every((column, index) => column.toLowerCase() === importColumns[index]));
  if (matches.length !== 1) {
    return { rows: [], errors: [candidates.find((candidate) => candidate.error)?.error
      || `CSV musí mať hlavičku s presne ${importColumns.length} stĺpcami v predpísanom poradí.`] };
  }
  const data = matches[0].records.slice(1);
  if (!data.length) return { rows: [], errors: ['CSV neobsahuje žiadnu zákazku.'] };
  if (data.length > 200) return { rows: [], errors: ['CSV môže obsahovať najviac 200 zákaziek.'] };

  const resolveWorker = (name: string, errors: string[]) => {
    const matches = workerNames.filter((worker) => matchesImportWorkerName(worker, name));
    if (matches.length === 0) errors.push(`neznámy pracovník: ${name}`);
    if (matches.length > 1) errors.push(`nejednoznačný pracovník: ${name}`);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const seen = new Set<string>();
  const rows = data.map(({ line, columns }): ImportPreviewRow => {
    const errors: string[] = [];
    if (columns.length !== importColumns.length) {
      errors.push(`očakáva sa ${importColumns.length} stĺpcov, nájdených ${columns.length}`);
      return { line, columns, errors };
    }
    const [rawSourceId, date, name, location, area, price, payment, work, weight, landfill, workers,
      fuel, suits, gloves, penetrant, other] = columns;
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(rawSourceId)) {
      errors.push('ID zákazky musí byť jedinečný stabilný kód s najviac 64 znakmi (písmená, čísla, bodka, pomlčka, podčiarkovník alebo lomka)');
    }
    const sourceId = rawSourceId.toUpperCase();
    if (!isValidIsoCalendarDate(date) || date > today) errors.push('dátum musí byť platný a nesmie byť v budúcnosti');
    if (!name || name.length > 200) errors.push('meno musí mať 1 až 200 znakov');
    if (!location || location.length > 200) errors.push('lokalita musí mať 1 až 200 znakov');
    const m2 = numberField(area, 'm2', errors, true, true);
    const pricePerM2 = numberField(price, 'cena za m2', errors, true);
    const wasteKg = numberField(weight, 'váha v kg', errors);
    const fuelAmount = numberField(fuel, 'nafta', errors);
    const suitsAmount = numberField(suits, 'obleky', errors);
    const glovesAmount = numberField(gloves, 'rukavice', errors);
    const penetrantAmount = numberField(penetrant, 'penetrák', errors);
    const otherAmount = numberField(other, 'iné náklady', errors);
    if (m2 * pricePerM2 > 9_999_999_999.99) errors.push('celková cena je mimo povoleného rozsahu');
    if (fuelAmount + suitsAmount + glovesAmount + penetrantAmount + otherAmount > 9_999_999_999.99) {
      errors.push('celkové náklady sú mimo povoleného rozsahu');
    }
    const paymentType = payment || 'FAKTURA';
    const workType = work || 'DEMONTAZ_A_ODVOZ';
    const landfillType = landfill || 'INA';
    if (!['FAKTURA', 'CASH'].includes(paymentType)) errors.push('platba musí byť FAKTURA alebo CASH');
    if (!['DEMONTAZ', 'ODVOZ', 'DEMONTAZ_A_ODVOZ'].includes(workType)) errors.push('neplatný typ práce');
    if (!['MOCHOVCE', 'LIVINKE_OPATOVCE', 'KOSICE', 'INA'].includes(landfillType)) errors.push('neplatná skládka');
    const selectedWorkers = workers ? workers.split(';').map((part) => part.trim()).filter(Boolean) : [];
    const resolvedWorkers = selectedWorkers.map((worker) => resolveWorker(worker, errors));
    if (new Set(resolvedWorkers.map((worker, index) => worker || selectedWorkers[index])).size !== selectedWorkers.length) {
      errors.push('pracovník je v riadku uvedený viackrát');
    }
    if (errors.length) return { line, columns, errors };
    const job: ImportJob = {
      sourceId,
      demolitionDate: date, customerName: name, location, m2, pricePerM2,
      paymentType: paymentType as BusinessPaymentType, workType: workType as BusinessWorkType,
      wasteKg, landfill: landfillType as BusinessLandfill,
      workerNames: resolvedWorkers as string[],
      fuel: fuelAmount, suits: suitsAmount, gloves: glovesAmount, penetrant: penetrantAmount, otherAmount,
    };
    if (seen.has(sourceId)) errors.push(`ID zákazky „${sourceId}“ je v CSV uvedené viackrát`);
    seen.add(sourceId);
    return { line, columns, errors, job: errors.length ? undefined : job };
  });
  return { rows, errors: [] };
}
