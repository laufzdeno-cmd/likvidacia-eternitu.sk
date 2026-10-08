import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const currentMatrixUrl = new URL(
  '../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md',
  import.meta.url,
);
const historicalMatrixUrl = new URL(
  '../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX.md',
  import.meta.url,
);
const botEvidenceUrl = new URL(
  '../docs/upgrade-2026-09-30/G09-BOT-ACCESS-SNAPSHOT-2026-10-09.md',
  import.meta.url,
);

function matrixRows(markdown) {
  return [...markdown.matchAll(/^\|\s*((?:S|G|F|U|O)\d{2})\s*\|\s*([^|]+?)\s*\|/gmu)]
    .map((match) => ({ id: match[1], status: match[2].trim() }));
}

function makeIds(prefix, count) {
  return Array.from({ length: count }, (_, index) => (
    `${prefix}${String(index + 1).padStart(2, '0')}`
  ));
}

const expectedIds = [
  ...makeIds('S', 10),
  ...makeIds('G', 11),
  ...makeIds('F', 14),
  ...makeIds('U', 10),
  ...makeIds('O', 10),
];

const scoredIds = {
  S: makeIds('S', 10),
  G: makeIds('G', 10),
  F: makeIds('F', 14),
  U: makeIds('U', 10),
  O: makeIds('O', 10),
};

const allowedStatuses = new Set([
  'PASS local',
  'PASS local current',
  'PASS local slices',
  'PASS current production evidence',
  'PASS local / production WAITING',
  'PARTIAL',
  'WAITING',
]);

const scoredPassStatuses = new Set([
  'PASS local',
  'PASS local current',
  'PASS local slices',
  'PASS current production evidence',
]);

function scoreFor(rows, ids) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const selected = ids.map((id) => {
    assert.ok(byId.has(id), `chýba bodovaný riadok ${id}`);
    return byId.get(id);
  });
  const passCount = selected.filter(({ status }) => scoredPassStatuses.has(status)).length;
  return Number(((passCount / ids.length) * 100).toFixed(1));
}

test('current acceptance matrix has one canonical 55-row inventory and a reproducible score', async () => {
  const [matrix, historical] = await Promise.all([
    readFile(currentMatrixUrl, 'utf8'),
    readFile(historicalMatrixUrl, 'utf8'),
  ]);
  const rows = matrixRows(matrix);
  const ids = rows.map(({ id }) => id);

  assert.deepEqual(ids, expectedIds);
  assert.equal(new Set(ids).size, expectedIds.length);
  assert.deepEqual(
    [...new Set(rows.map(({ status }) => status))].filter((status) => !allowedStatuses.has(status)),
    [],
    'matica obsahuje neznámy alebo nejednoznačný stav',
  );

  const scores = {
    S: scoreFor(rows, scoredIds.S),
    G: scoreFor(rows, scoredIds.G),
    F: scoreFor(rows, scoredIds.F),
    U: scoreFor(rows, scoredIds.U),
    O: scoreFor(rows, scoredIds.O),
  };
  assert.deepEqual(scores, { S: 80, G: 50, F: 64.3, U: 80, O: 30 });

  const weighted = Number((
    0.25 * scores.S
    + 0.25 * scores.G
    + 0.25 * scores.F
    + 0.15 * scores.U
    + 0.10 * scores.O
  ).toFixed(1));
  assert.equal(weighted, 63.6);
  assert.match(matrix, /\*\*S = 80\/100, G = 50\/100, F = 64,3\/100, U = 80\/100 a O = 30\/100\*\*/u);
  assert.match(matrix, /\*\*63,6\/100\*\*/u);
  assert.match(matrix, /Táto matica nahrádza historickú maticu `E8-ACCEPTANCE-MATRIX\.md`/u);
  assert.match(historical, /> Historická matica/u);
});

test('G09 production bot evidence is explicit, privacy-safe and reflected as PASS', async () => {
  const [matrix, evidence] = await Promise.all([
    readFile(currentMatrixUrl, 'utf8'),
    readFile(botEvidenceUrl, 'utf8'),
  ]);

  assert.match(matrix, /^\| G09 \| PASS current production evidence \|/mu);
  assert.match(matrix, /G09-BOT-ACCESS-SNAPSHOT-2026-10-09\.md/u);
  assert.match(evidence, /`OAI-AdsBot\/1\.0` \| 607/u);
  assert.match(evidence, /`OAI-SearchBot\/1\.0` \| 177/u);
  assert.match(evidence, /`ChatGPT-User\/1\.0` \| 109/u);
  assert.match(evidence, /`\/` \| 6/u);
  assert.match(evidence, /`\/robots\.txt` \| 5/u);
  assert.match(evidence, /domovskú stránku HTTP `200`/u);
  assert.match(evidence, /`robots\.txt`[^\n]*HTTP `200`/u);
  assert.match(evidence, /\*\*G09 = PASS current production evidence\.\*\*/u);
  assert.match(evidence, /Bot Protection[^\n]*`Inactive`/u);
  assert.doesNotMatch(evidence, /\b(?:\d{1,3}\.){3}\d{1,3}\b/u);
  assert.doesNotMatch(evidence, /(?:token|secret|password)\s*[=:]\s*\S+/iu);
});
