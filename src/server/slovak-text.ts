const replacements: Array<[RegExp, string]> = [
  [/Vlnit\? eternit/gi, 'Vlnitý eternit'],
  [/Hladk\? eternit/gi, 'Hladký eternit'],
  [/Rodinn\? dom/gi, 'Rodinný dom'],
  [/Hospod\?rska budova/gi, 'Hospodárska budova'],
  [/Nem\?m strech\?ra/gi, 'Nemám strechára'],
  [/\?o najsk\?r/gi, 'Čo najskôr'],
  [/\bM2\b/g, 'm2'],
  [/M²/g, 'm2'],
  [/m²/g, 'm2'],
  [/mÂ˛/g, 'm2'],
  [/â€“/g, '–'],
  [/â€”/g, '—'],
  [/Â·/g, '·'],
  [/â‚¬/g, '€'],
  [/â†’/g, '→'],
  [/âś…/g, '✓'],
  [/âťŚ/g, '✕'],
  [/âš ď¸Ź/g, '⚠'],
  [/CenovĂ©/g, 'Cenové'],
  [/cenovĂş/g, 'cenovú'],
  [/cenovĂˇ/g, 'cenová'],
  [/NovĂˇ/g, 'Nová'],
  [/SpĂ¤ĹĄ/g, 'Späť'],
  [/DĂˇtum/g, 'Dátum'],
  [/ZĂˇkaznĂ­k/g, 'Zákazník'],
  [/ZĂˇkazka/g, 'Zákazka'],
  [/ZĂˇkazky/g, 'Zákazky'],
  [/ZĂˇkaziek/g, 'Zákaziek'],
  [/Lokalita/g, 'Lokalita'],
  [/MateriĂˇl/g, 'Materiál'],
  [/VĂ˝mera/g, 'Výmera'],
  [/TelefĂłn/g, 'Telefón'],
  [/PoznĂˇmka/g, 'Poznámka'],
  [/DokonÄŤenĂˇ/g, 'Dokončená'],
  [/zruĹˇenĂˇ/g, 'zrušená'],
  [/OdhlĂˇsiĹĄ/g, 'Odhlásiť'],
  [/Pracujem/g, 'Pracujem'],
  [/SklĂˇdky/g, 'Skládky'],
  [/NĂˇklady/g, 'Náklady'],
  [/TrĹľby/g, 'Tržby'],
  [/VytvoriĹĄ/g, 'Vytvoriť'],
  [/UloĹľiĹĄ/g, 'Uložiť'],
  [/OdoslaĹĄ/g, 'Odoslať'],
];

export function cleanSlovakText(value?: string | null) {
  if (!value) return '';
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function leadEventLabel(action: string, changes?: Record<string, unknown>) {
  const labels: Record<string, string> = {
    lead_created: 'Dopyt prijatý',
    lead_email_sent: 'Email odoslaný zákazníkovi',
    lead_email_failed: 'Email sa nepodarilo odoslať',
    files_uploaded: `Fotky nahrané (${Number(changes?.count || 0)} súborov)`,
    status_changed: `Stav zmenený na: ${cleanSlovakText(String(changes?.next || ''))}`,
    note_added: 'Poznámka pridaná',
    internal_note_changed: 'Interná poznámka upravená',
    cp_created: `Cenová ponuka č. ${changes?.number || ''} vytvorená`,
    cp_sent: 'Cenová ponuka odoslaná',
    roofer_assigned: `Strechár priradený: ${changes?.name || ''}`,
    lead_file_deleted: `Príloha zmazaná: ${changes?.fileName || ''}`,
  };
  return labels[action] || cleanSlovakText(action);
}
