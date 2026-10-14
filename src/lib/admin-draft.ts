export type AdminDraftType = 'summary' | 'reply' | 'followup' | 'note' | 'offer';

export const adminDraftLabels: Record<AdminDraftType, string> = {
  summary: 'Zhrnutie dopytu',
  reply: 'Odpoveď zákazníkovi',
  followup: 'Follow-up po ponuke',
  note: 'Interná poznámka',
  offer: 'Podklady k cenovej ponuke',
};

export function makeDeterministicAdminDraft(type: AdminDraftType, name: string, locality: string, facts: string) {
  const customer = name.trim() || 'zákazník';
  const place = locality.trim() || 'neuvedená lokalita';
  const safeFacts = facts.trim() || 'Doplňte overené fakty zo záznamu.';
  if (type === 'summary') return `Zákazník: ${customer}\nLokalita: ${place}\nOverené podklady: ${safeFacts}\n\nChýba overiť: rozsah prác, prístup, termín, fotografie a spôsob odvozu.\nĎalší krok: manuálne skontrolovať záznam a určiť zodpovednú osobu.`;
  if (type === 'reply') return `Dobrý deň, ${customer},\n\nďakujeme za váš dopyt na likvidáciu eternitu v lokalite ${place}. Máme k dispozícii tieto informácie: ${safeFacts}\n\nPred prípravou presnej cenovej ponuky údaje ešte manuálne preveríme. Ak bude niečo chýbať, ozveme sa vám.\n\nS pozdravom\nASTANA`;
  if (type === 'followup') return `Dobrý deň, ${customer},\n\nchceme sa uistiť, či ste mali priestor pozrieť si našu cenovú ponuku pre lokalitu ${place}. Ak potrebujete niečo vysvetliť alebo doplniť, radi vám pomôžeme.\n\nPonuka ani termín sa týmto návrhom nemenia. Odpoveď pred odoslaním skontrolujeme.\n\nS pozdravom\nASTANA`;
  if (type === 'note') return `Interná poznámka\nZákazník: ${customer}\nLokalita: ${place}\nFakty: ${safeFacts}\nĎalší krok: [DOPLNIŤ]\nZodpovedná osoba: [DOPLNIŤ]\nTermín: [DOPLNIŤ]`;
  return `Podklady k CP — NEODOSIELAŤ BEZ SCHVÁLENIA\nKontakt: ${customer}\nLokalita: ${place}\nOverené zadanie: ${safeFacts}\n\nPred vytvorením CP overiť:\n• presnú výmeru a materiál,\n• rozsah demontáže a odvozu,\n• prístup a logistiku,\n• dopravu podľa platného pravidla,\n• termín realizácie,\n• všetky ceny a DPH.`;
}
