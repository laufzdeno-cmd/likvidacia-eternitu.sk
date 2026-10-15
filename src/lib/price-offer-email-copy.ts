import type { PriceOffer, PriceOfferInput } from '@/src/server/types';

type OfferEmailSource = Pick<PriceOfferInput, 'municipality' | 'objectAddress' | 'objectType' | 'realizationTerm' | 'materialType'>
  & Partial<Pick<PriceOffer, 'number'>>;

const materialLabels: Record<PriceOfferInput['materialType'], string> = {
  VLNITY_ETERNIT: 'Vlnitý eternit (AZC)',
  HLADKY_ETERNIT: 'Hladký eternit',
  AZBESTOVE_RURY: 'Azbestové rúry',
  PODHLADOVE_DOSKY: 'Podhľadové dosky',
  BOLETICKY: 'Boletické panely',
  INE: 'Azbestový materiál',
};

export function defaultPriceOfferEmailSubject(offer: OfferEmailSource) {
  const location = offer.municipality || offer.objectAddress;
  const number = offer.number ? ` č. ${offer.number}` : '';
  return `Cenová ponuka${number} — ASTANA${location ? ` | ${location}` : ''}`.slice(0, 180);
}

export function defaultPriceOfferEmailBody(offer: OfferEmailSource) {
  const number = offer.number ? ` č. ${offer.number}` : '';
  const location = offer.municipality || offer.objectAddress;
  const material = materialLabels[offer.materialType];
  return [
    'Dobrý deň,',
    '',
    `na základe vášho dopytu vám posielame cenovú ponuku${number} na odbornú likvidáciu materiálu ${material}${offer.objectType ? ` na objekte typu ${offer.objectType}` : ''}${location ? ` v lokalite ${location}` : ''}.`,
    '',
    'Kompletný rozsah prác, cenu a podmienky nájdete v priloženom PDF dokumente.',
    offer.realizationTerm ? `Predpokladaný termín realizácie: ${offer.realizationTerm}.` : '',
    '',
    'Ak vám ponuka vyhovuje, stačí odpovedať na tento e-mail. Radi si s vami potvrdíme údaje a dohodneme ďalší postup.',
  ].filter((line) => line !== '').join('\n\n');
}

