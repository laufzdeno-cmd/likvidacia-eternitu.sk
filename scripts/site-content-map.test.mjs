import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSiteContent } from '../src/server/site-content-map.ts';

test('saved admin text survives a new default version', () => {
  const result = mergeSiteContent(
    { heroTitle: 'New default', newSection: 'Helpful default' },
    [{ key: 'heroTitle', value: 'Owner-edited headline', updatedAt: '2026-09-30T00:00:00.000Z' }],
  );

  assert.deepEqual(result, {
    heroTitle: 'Owner-edited headline',
    newSection: 'Helpful default',
  });
});

test('stored empty values remain intentional while missing values use defaults', () => {
  const result = mergeSiteContent(
    { subtitle: 'Default', title: 'Default title' },
    [{ key: 'subtitle', value: '', updatedAt: '2026-09-30T00:00:00.000Z' }],
  );

  assert.equal(result.subtitle, '');
  assert.equal(result.title, 'Default title');
});

test('outdated saved legal FAQ is replaced while other saved FAQ entries are preserved', () => {
  const result = mergeSiteContent(
    {
      faqItems: 'Treba na práce povolenie od RÚVZ?|Plánované práce povoľuje RÚVZ.'
        + '\nPotrebujete fotky?|Fotky sú dobrovoľné.',
    },
    [{
      key: 'faqItems',
      value: 'Treba na prace povolenie od RUVZ?|Treba si vyziadat povolenie pred zaciatkom.'
        + '\nTreba rozhodnutie RÚVZ?|Vyžiadajte si ho pred prácami.'
        + '\nJe potrebné povolenie na práce?|Áno, treba počkať na povolenie.'
        + '\nAko zladiť práce s RÚVZ?|Termín plánujeme podľa nadväzujúcich prác.'
        + '\nPotrebujete fotky?|Fotky pomôžu pripraviť ponuku.',
      updatedAt: '2026-09-30T00:00:00.000Z',
    }],
  );

  assert.equal(result.faqItems, 'Treba na práce povolenie od RÚVZ?|Plánované práce povoľuje RÚVZ.'
    + '\nAko zladiť práce s RÚVZ?|Termín plánujeme podľa nadväzujúcich prác.'
    + '\nPotrebujete fotky?|Fotky pomôžu pripraviť ponuku.');
});

test('differently worded duplicate legal CMS FAQs collapse to one current answer', () => {
  const result = mergeSiteContent(
    {
      faqItems: 'Treba na práce povolenie od RÚVZ?|Držiteľ oprávnenia oznamuje plánované práce RÚVZ najmenej 30 dní vopred; nejde o žiadosť o povolenie.',
    },
    [{
      key: 'faqItems',
      value: 'Treba rozhodnutie RÚVZ?|Vyžiadajte si povolenie.'
        + '\nČo treba vedieť o povolení RÚVZ pri práci s azbestom?|Treba požiadať o povolenie.'
        + '\nOznamuje sa odstraňovanie azbestu?|Áno, žiada sa povolenie.'
        + '\nČo robiť s eternitom?|Kontaktujte odborníkov.',
      updatedAt: '2026-09-30T00:00:00.000Z',
    }],
  );

  assert.equal(result.faqItems, 'Treba na práce povolenie od RÚVZ?|Držiteľ oprávnenia oznamuje plánované práce RÚVZ najmenej 30 dní vopred; nejde o žiadosť o povolenie.'
    + '\nČo robiť s eternitom?|Kontaktujte odborníkov.');
});

test('outdated generic authorization FAQ is replaced without overwriting unrelated admin copy', () => {
  const result = mergeSiteContent(
    {
      faqItems: 'Treba na práce povolenie od RÚVZ?|Plánované práce sa oznamujú najmenej 30 dní vopred; nejde o žiadosť o povolenie.'
        + '\nStačí, že firma má oprávnenie na odstraňovanie azbestu?|Rozsah oprávnenia musí zodpovedať konkrétnemu typu prác.',
    },
    [{
      key: 'faqItems',
      value: 'Stačí, že firma má všeobecné oprávnenie na azbest?|Áno, všeobecné oprávnenie stačí.'
        + '\nPotrebujete fotky?|Vlastný text majiteľa zostáva zachovaný.'
        + '\nRozhoduje pri likvidácii azbestu iba cena?|Vlastný obchodný text zostáva zachovaný.'
        + '\nPovoľujete platbu na splátky pri likvidácii azbestu?|Vlastný platobný text zostáva zachovaný.'
        + '\nOznámite cenu za likvidáciu azbestu?|Vlastný cenový text zostáva zachovaný.'
        + '\nJe reklamácia oprávnená pri likvidácii azbestu?|Vlastný reklamačný text zostáva zachovaný.'
        + '\nMá firma oprávnenie na likvidáciu eternitu?|Staršia duplicitná odpoveď.',
      updatedAt: '2026-10-07T00:00:00.000Z',
    }],
  );

  assert.equal(result.faqItems, 'Stačí, že firma má oprávnenie na odstraňovanie azbestu?|Rozsah oprávnenia musí zodpovedať konkrétnemu typu prác.'
    + '\nPotrebujete fotky?|Vlastný text majiteľa zostáva zachovaný.'
    + '\nRozhoduje pri likvidácii azbestu iba cena?|Vlastný obchodný text zostáva zachovaný.'
    + '\nPovoľujete platbu na splátky pri likvidácii azbestu?|Vlastný platobný text zostáva zachovaný.'
    + '\nOznámite cenu za likvidáciu azbestu?|Vlastný cenový text zostáva zachovaný.'
    + '\nJe reklamácia oprávnená pri likvidácii azbestu?|Vlastný reklamačný text zostáva zachovaný.'
    + '\nTreba na práce povolenie od RÚVZ?|Plánované práce sa oznamujú najmenej 30 dní vopred; nejde o žiadosť o povolenie.');
});

test('legacy early-arrival CMS copy is replaced by the approved 8:00–18:00 wording', () => {
  const currentRooferLine = 'Zladenie termínu|Práce plánujeme v pracovných dňoch od 8:00 do 18:00. Konkrétny čas nástupu dohodneme podľa lokality.';
  const currentFaqLine = 'Pomôžete zladiť likvidáciu so strechárom?|Áno. Práce plánujeme v pracovných dňoch od 8:00 do 18:00.';
  const result = mergeSiteContent(
    {
      rooferItems: `${currentRooferLine}\nSledujeme počasie|Vlastný text zostáva.`,
      faqItems: `${currentFaqLine}\nPotrebujete fotky?|Fotky sú dobrovoľné.`,
    },
    [
      {
        key: 'rooferItems',
        value: 'Zladenie termínu|Z Popradu vyrážame skoro ráno, aby sme boli na stavbe medzi 6:00 a 6:30.\nSledujeme počasie|Vlastný text majiteľa zostáva.',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
      {
        key: 'faqItems',
        value: 'Pomôžete zladiť likvidáciu so strechárom?|Pri vzdialenejších strechách vyrážame skoro ráno o 6.00.\nPotrebujete fotky?|Vlastná odpoveď zostáva.',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
    ],
  );

  assert.equal(result.rooferItems, `${currentRooferLine}\nSledujeme počasie|Vlastný text majiteľa zostáva.`);
  assert.equal(result.faqItems, `${currentFaqLine}\nPotrebujete fotky?|Vlastná odpoveď zostáva.`);
  assert.doesNotMatch(`${result.rooferItems}\n${result.faqItems}`, /6[:.]00|6[:.]30|skoro ráno/i);
});
