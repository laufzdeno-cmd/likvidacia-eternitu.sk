'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { FinancialJobWorkspaceCard, JobAuthorityKind, JobAuthorityRecord, JobMaterialItem, JobWorkPlan, JobWorkspaceCard, JobWorkspaceOperations, JobWorkspaceSettlement } from '@/src/server/job-workspace-types';
import { jobStatusLabels, jobStatuses, normalizeWorkflowStatus, workTypeLabels } from '../constants';
import { saveWorkspaceAction, type WorkspaceActionState } from './workspace-actions';
import styles from './workspace.module.css';

type DocumentOption = { id: string; name: string };
type WorkerOption = { id: string; name: string };
type Props = { card: JobWorkspaceCard | FinancialJobWorkspaceCard; csrfToken: string; archived: boolean; customerName: string; location: string; documents: DocumentOption[]; workers: WorkerOption[]; owners: Array<{ name: string; email: string }>; authorityNotice?: ReactNode; offers?: ReactNode; communication?: ReactNode; photos?: ReactNode; paymentSummary?: ReactNode };
const initialState: WorkspaceActionState = { ok: false, message: '', card: null };
const materialLabels = { VLNITY_ETERNIT: 'Vlnitý eternit', HLADKY_ETERNIT: 'Hladký eternit', INTERIER: 'Interiér – steny, obklady, podhľady', AZBESTOVE_RURY: 'Azbestové rúry', VZDUCHOTECHNIKA: 'Vzduchotechnika', INE: 'Iný materiál' } as const;
const unitLabels = { M2: 'm²', M: 'm', KS: 'ks', KG: 'kg' } as const;
const triLabels = { UNKNOWN: 'Zatiaľ neurčené', YES: 'Áno', NO: 'Nie' } as const;
const authorityLabels = { OU_ZP: 'OÚ ŽP – životné prostredie', RUVZ: 'RÚVZ – verejné zdravotníctvo' } as const;
const decisionLabels = { PENDING: 'Čakáme na vybavenie', APPROVED: 'Schválené / vybavené', REJECTED: 'Zamietnuté', NOT_APPLICABLE: 'Rozhodnutie sa nevyžaduje' } as const;
const dateTime = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bratislava' });
const number = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 });
const auditLabels: Record<string, string> = { responsibleEmail: 'Zodpovedná osoba', workType: 'Druh práce', status: 'Stav práce', materials: 'Materiály a množstvá', authorities: 'Podania a rozhodnutia úradov', plan: 'Plánovanie a priebeh', note: 'Interná poznámka', updated: 'Vyúčtovanie' };
const fieldLabels: Record<string, string> = { required:'Potrebnosť',submittedOn:'Odoslané',submissionMethod:'Spôsob podania',reference:'Spis / podanie',documentId:'Dokument',decision:'Výsledok',decisionOn:'Rozhodnutie',note:'Poznámka',tentativeOn:'Predbežne',agreedOn:'Dohodnutý termín',actualOn:'Skutočný deň',timeFrom:'Od',timeTo:'Do',crewIds:'Pracovníci',plannedCrewCount:'Plán ľudí',actualCrewCount:'Skutočný počet ľudí',vehicleIds:'Vozidlá',plannedVehicleCount:'Plán áut',actualVehicleCount:'Skutočný počet áut',confirmedCapacityKg:'Potvrdená nosnosť kg',plannedKm:'Plán km',actualKm:'Skutočné km',distanceBasis:'Trasa',scaffolding:'Lešenie',platform:'Plošina',accessNote:'Prístup',promotionNote:'Akcia / dohoda',rescheduleReason:'Dôvod presunu',kind:'Materiál',label:'Popis',unit:'Jednotka',plannedQuantity:'Plán množstva',actualQuantity:'Skutočné množstvo',plannedKg:'Plán kg',actualKg:'Skutočné kg',documentType:'Typ dokladu',agreedAmountWithVatCents:'Dohodnutá cena v centoch',actualAmountWithVatCents:'Skutočná cena v centoch',plannedCostCents:'Plán nákladov v centoch',actualCostCents:'Skutočné náklady v centoch',OU_ZP:'OÚ ŽP',RUVZ:'RÚVZ' };
const valueLabels: Record<string, string> = { ...triLabels, ...materialLabels, ...unitLabels, ...decisionLabels, ...jobStatusLabels, ...workTypeLabels, UNKNOWN:'Zatiaľ neurčené', ONE_WAY_FROM_POPRAD:'Jedna cesta z Popradu', ROUND_TRIP_FROM_POPRAD:'Cesta z Popradu aj späť', UNDECIDED:'Zatiaľ neurčený', INVOICE:'Faktúra', OTHER_DOCUMENT:'Iný doklad' };

function readable(value: unknown, references: Record<string, string> = {}): string {
  if (value === null || value === undefined || value === '') return 'Neurčené';
  if (Array.isArray(value)) return value.length ? value.map((item) => readable(item, references)).join('; ') : 'Bez položiek';
  if (typeof value === 'object') return Object.entries(value).filter(([key]) => key !== 'id').map(([key, item]) => `${fieldLabels[key] || key}: ${readable(item, references)}`).join(' · ');
  return references[String(value)] || valueLabels[String(value)] || String(value);
}
function numeric(value: string) { return value === '' ? null : Number(value); }
function Quantity({ label, value, onChange, unit, integer = false }: { label: string; value: number | null; onChange: (value: number | null) => void; unit?: string; integer?: boolean }) {
  return <label>{label}{unit ? ` (${unit})` : ''}<input type="number" min="0" max="1000000000" step={integer ? '1' : '0.01'} value={value ?? ''} placeholder="Neurčené" onChange={(event) => onChange(numeric(event.target.value))} /></label>;
}
function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) { return <label>{label}<input type="date" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} /></label>; }
function TriField({ label, value, onChange }: { label: string; value: 'UNKNOWN' | 'YES' | 'NO'; onChange: (value: 'UNKNOWN' | 'YES' | 'NO') => void }) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value as typeof value)}>{Object.entries(triLabels).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label>; }
function SaveButton({ disabled }: { disabled: boolean }) { const { pending } = useFormStatus(); return <button className={styles.primary} type="submit" disabled={disabled || pending}>{pending ? 'Ukladám kartu…' : 'Uložiť pracovnú kartu'}</button>; }
function printCrewCard() {
  document.body.dataset.astanaCrewPrint = 'true';
  try { window.print(); } finally { delete document.body.dataset.astanaCrewPrint; }
}
function openWorkspaceSection(id: string) {
  const target = document.getElementById(id);
  const workspace = document.getElementById('pracovna-karta');
  workspace?.querySelectorAll<HTMLDetailsElement>(':scope > details, :scope > form[data-workspace-ready] > fieldset > details').forEach((section) => { section.open = section === target; });
  if (target instanceof HTMLDetailsElement) target.open = true;
}

export default function WorkspacePanel({ card, csrfToken, archived, customerName, location, documents, workers, owners, authorityNotice, offers, communication, photos, paymentSummary }: Props) {
  const [operations, setOperations] = useState<JobWorkspaceOperations>(card.operations);
  const [settlement, setSettlement] = useState<JobWorkspaceSettlement | undefined>('settlement' in card ? card.settlement : undefined);
  const [vehicleText, setVehicleText] = useState(card.operations.plan.vehicleIds.join(', '));
  const [state, action, saving] = useActionState(saveWorkspaceAction, initialState);
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(card.revision);
  const [baseStatus, setBaseStatus] = useState(card.operations.status);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState('karta-prehlad');
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    const navigateHash = () => {
      const id = window.location.hash.slice(1);
      if (!/^karta-(prehlad|materialy|ponuky|urady|planovanie|komunikacia|fotky|vyuctovanie)$/.test(id)) return;
      setActiveSection(id);
      openWorkspaceSection(id);
    };
    navigateHash();
    window.addEventListener('hashchange', navigateHash);
    return () => window.removeEventListener('hashchange', navigateHash);
  }, []);
  useEffect(() => {
    if (!state.card) return;
    setOperations(state.card.operations);
    setVehicleText(state.card.operations.plan.vehicleIds.join(', '));
    setSettlement('settlement' in state.card ? state.card.settlement : undefined);
    setRevision(state.card.revision);
    setBaseStatus(state.card.operations.status);
    setDirty(false);
  }, [state.card]);
  useEffect(() => {
    if (dirty || card.revision < revision) return;
    setOperations(card.operations);
    setVehicleText(card.operations.plan.vehicleIds.join(', '));
    setSettlement('settlement' in card ? card.settlement : undefined);
    setRevision(card.revision);
    setBaseStatus(card.operations.status);
  }, [card, dirty, revision]);
  const [historyLimit, setHistoryLimit] = useState(12);
  const savedCard = state.card && state.card.revision > card.revision ? state.card : card;
  const patch = { expectedRevision: revision, operations, ...(settlement ? { settlement } : {}) };
  const setOperation = <K extends keyof JobWorkspaceOperations>(key: K, value: JobWorkspaceOperations[K]) => { setDirty(true); setOperations((previous) => ({ ...previous, [key]: value })); };
  const setPlan = <K extends keyof JobWorkPlan>(key: K, value: JobWorkPlan[K]) => { setDirty(true); setOperations((previous) => ({ ...previous, plan: { ...previous.plan, [key]: value } })); };
  const setAuthority = <K extends keyof JobAuthorityRecord>(kind: JobAuthorityKind, key: K, value: JobAuthorityRecord[K]) => { setDirty(true); setOperations((previous) => ({ ...previous, authorities: { ...previous.authorities, [kind]: { ...previous.authorities[kind], [key]: value } } })); };
  const setMaterial = <K extends keyof JobMaterialItem>(id: string, key: K, value: JobMaterialItem[K]) => { setDirty(true); setOperations((previous) => ({ ...previous, materials: previous.materials.map((item) => item.id === id ? { ...item, [key]: value } : item) })); };
  const updateSettlement = (value: JobWorkspaceSettlement) => { setDirty(true); setSettlement(value); };
  const addMaterial = () => setOperation('materials', [...operations.materials, { id: crypto.randomUUID(), kind: 'VLNITY_ETERNIT', label: '', unit: 'M2', plannedQuantity: null, actualQuantity: null, plannedKg: null, actualKg: null }]);
  const timeline = [...savedCard.timeline].reverse();
  const namedReferences = Object.fromEntries([...workers.map((worker) => [worker.id, worker.name]), ...documents.map((document) => [document.id, document.name])]);
  const crewNames = operations.plan.crewIds.map((id) => workers.find((worker) => worker.id === id)?.name ?? 'Neaktívny pracovník');

  return <div className={styles.workspace} id="pracovna-karta">
    <header className={styles.hero}>
      <div><p>Jedna zákazka, všetky súvislosti</p><h2>Pracovná karta · {card.number}</h2><span>{savedCard.updatedAt ? `Posledná zmena ${dateTime.format(new Date(savedCard.updatedAt))} · ${savedCard.updatedBy}` : 'Podrobnosti doplníte postupne. Neznáme hodnoty zostávajú prázdne.'}</span></div>
      <strong className={styles.badge}>{archived ? 'Archív · len čítanie' : `Revízia ${revision}`}</strong>
    </header>
    <nav className={`${styles.navigation} no-print`} aria-label="Časti zákazkovej karty">
      {([['karta-prehlad', 'Prehľad'], ['karta-materialy', 'Materiály'], ['karta-ponuky', 'Ponuky'], ['karta-urady', 'Úrady'], ['karta-planovanie', 'Plánovanie'], ['karta-komunikacia', 'Komunikácia'], ['karta-fotky', 'Fotky']] as const).map(([id, label]) => <a href={`#${id}`} key={id} aria-current={activeSection === id ? 'location' : undefined} onClick={() => { setActiveSection(id); openWorkspaceSection(id); }}>{label}</a>)}{settlement ? <a href="#karta-vyuctovanie" aria-current={activeSection === 'karta-vyuctovanie' ? 'location' : undefined} onClick={() => { setActiveSection('karta-vyuctovanie'); openWorkspaceSection('karta-vyuctovanie'); }}>Vyúčtovanie</a> : null}
    </nav>
    <form action={action} className={`${styles.form} no-print`} data-workspace-ready={ready ? 'true' : 'false'}>
      <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="jobId" value={card.jobId} /><input type="hidden" name="workspace" value={JSON.stringify(patch)} />
      <fieldset disabled={archived || !ready || saving} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        <details className={styles.section} id="karta-prehlad" open data-tone="teal">
          <summary><span>Prehľad a zodpovednosť<small>Stav práce, človek zodpovedný za ďalší krok a interné pokyny</small></span></summary>
          <div className={styles.body}><div className={styles.grid}>
            <label>Zodpovedná osoba za zákazku<select value={operations.responsibleEmail} onChange={(event) => setOperation('responsibleEmail', event.target.value)}><option value="">Zatiaľ nepriradená</option>{operations.responsibleEmail && !owners.some((owner) => owner.email === operations.responsibleEmail) ? <option value={operations.responsibleEmail} disabled>{operations.responsibleEmail} · vyberte aktívny účet</option> : null}{owners.map((owner) => <option key={owner.email} value={owner.email}>{owner.name || owner.email} · {owner.email}</option>)}</select></label>
            <label>Druh práce<select value={operations.workType} onChange={(event) => setOperation('workType', event.target.value as JobWorkspaceOperations['workType'])}>{Object.entries(workTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Stav práce<select value={normalizeWorkflowStatus(operations.status)} onChange={(event) => setOperation('status', event.target.value as JobWorkspaceOperations['status'])}>{jobStatuses.filter((status) => status !== 'DOKONCENA' || card.operations.status === 'DOKONCENA').map((status) => <option key={status} value={status}>{jobStatusLabels[status]}</option>)}</select><small>Úplné dokončenie potvrdíte cez sprievodcu dokončením.</small></label>
            <label className={styles.full}>Interné pokyny k zákazke<textarea rows={3} maxLength={5000} value={operations.note} onChange={(event) => setOperation('note', event.target.value)} /></label>
          </div><div><a className={styles.button} href="#udaje-zakazky">Upraviť kontakt a základné údaje zákazky</a></div></div>
        </details>

        <details className={styles.section} id="karta-materialy" data-tone="teal">
          <summary><span>Materiály a množstvá<small>Plán a skutočnosť samostatne, s primeranými jednotkami</small></span></summary>
          <div className={styles.body}>
            <p className={styles.quiet}>Doplňte iba známe hodnoty. Hmotnosť sa nevypočítava z vymyslených koeficientov; rúry či vzduchotechnika môžu byť v metroch alebo kusoch.</p>
            {operations.materials.map((item, index) => <article className={styles.material} key={item.id}>
              <div className={styles.materialHeader}><strong>Materiál {index + 1}</strong><button className={`${styles.button} ${styles.danger}`} type="button" onClick={() => setOperation('materials', operations.materials.filter((entry) => entry.id !== item.id))}>Odobrať</button></div>
              <div className={styles.grid}><label>Typ materiálu<select value={item.kind} onChange={(event) => setMaterial(item.id, 'kind', event.target.value as JobMaterialItem['kind'])}>{Object.entries(materialLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Upresnenie<input maxLength={5000} value={item.label} placeholder="Napr. obklad garáže" onChange={(event) => setMaterial(item.id, 'label', event.target.value)} /></label><label>Jednotka<select value={item.unit} onChange={(event) => setMaterial(item.id, 'unit', event.target.value as JobMaterialItem['unit'])}>{Object.entries(unitLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
              <div className={styles.quantityGrid}><Quantity label="Plán množstva" unit={unitLabels[item.unit]} value={item.plannedQuantity} onChange={(value) => setMaterial(item.id, 'plannedQuantity', value)} /><Quantity label="Skutočné množstvo" unit={unitLabels[item.unit]} value={item.actualQuantity} onChange={(value) => setMaterial(item.id, 'actualQuantity', value)} /><Quantity label="Plán hmotnosti" unit="kg" value={item.plannedKg} onChange={(value) => setMaterial(item.id, 'plannedKg', value)} /><Quantity label="Skutočná hmotnosť" unit="kg" value={item.actualKg} onChange={(value) => setMaterial(item.id, 'actualKg', value)} /></div>
            </article>)}
            {!operations.materials.length ? <p className={styles.quiet}>Zatiaľ bez materiálových položiek.</p> : null}
            <div><button type="button" className={styles.button} onClick={addMaterial} disabled={operations.materials.length >= 100}>+ Pridať materiál</button></div>
          </div>
        </details>

        <details className={styles.section} id="karta-urady" data-tone="gold" onToggle={(event) => { if (event.currentTarget.open) setActiveSection('karta-urady'); }}>
          <summary><span>Podania na úrady<small>OÚ ŽP a RÚVZ sa evidujú osobitne podľa konkrétnej zákazky</small></span></summary>
          <div className={styles.body}>
            {(['OU_ZP', 'RUVZ'] as const).map((kind) => { const record = operations.authorities[kind]; return <section className={styles.authority} key={kind}>
              <h3>{authorityLabels[kind]}</h3><div className={styles.grid}>
                <TriField label="Je tento krok potrebný?" value={record.required} onChange={(value) => setAuthority(kind, 'required', value)} />
                <DateField label="Podklady skutočne odoslané" value={record.submittedOn} onChange={(value) => setAuthority(kind, 'submittedOn', value)} />
                <label>Spôsob podania<input maxLength={5000} value={record.submissionMethod} placeholder="Napr. elektronicky / poštou" onChange={(event) => setAuthority(kind, 'submissionMethod', event.target.value)} /></label>
                <label>Číslo podania / spisu<input maxLength={5000} value={record.reference} onChange={(event) => setAuthority(kind, 'reference', event.target.value)} /></label>
                <label>Súkromný doklad<select value={record.documentId ?? ''} onChange={(event) => setAuthority(kind, 'documentId', event.target.value || null)}><option value="">Bez pripojeného dokladu</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}</select><small>Doklad najprv nahrajte do súkromných súborov zákazky.</small></label>
                <label>Stav vybavenia<select value={record.decision} onChange={(event) => setAuthority(kind, 'decision', event.target.value as JobAuthorityRecord['decision'])}>{Object.entries(decisionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <DateField label="Dátum rozhodnutia / vybavenia" value={record.decisionOn} onChange={(value) => setAuthority(kind, 'decisionOn', value)} />
                <label className={styles.full}>Poznámka k podaniu<textarea rows={2} maxLength={5000} value={record.note} onChange={(event) => setAuthority(kind, 'note', event.target.value)} /></label>
              </div>
            </section>; })}
            <p className={styles.quiet}>Uloženie podania samo neposiela email. Po uložení skontrolujete samostatný náhľad oznámenia zákazníkovi.</p>
          </div>
        </details>

        <details className={styles.section} id="karta-planovanie">
          <summary><span>Termín, posádka a doprava<small>Predbežný plán oddelený od dohody a skutočného priebehu</small></span></summary>
          <div className={styles.body}>
            <div className={styles.grid}><DateField label="Predbežný deň" value={operations.plan.tentativeOn} onChange={(value) => setPlan('tentativeOn', value)} /><DateField label="Dohodnutý deň" value={operations.plan.agreedOn} onChange={(value) => setPlan('agreedOn', value)} /><DateField label="Skutočný deň realizácie" value={operations.plan.actualOn} onChange={(value) => setPlan('actualOn', value)} /><label>Čas od<input type="time" value={operations.plan.timeFrom} onChange={(event) => setPlan('timeFrom', event.target.value)} /></label><label>Čas do<input type="time" value={operations.plan.timeTo} onChange={(event) => setPlan('timeTo', event.target.value)} /></label><label>Dôvod presunu / zmeny termínu<input maxLength={5000} value={operations.plan.rescheduleReason} placeholder="Napr. počasie, zákazník, úrady…" onChange={(event) => setPlan('rescheduleReason', event.target.value)} /></label></div>
            <div className={styles.grid}><Quantity integer label="Plánovaný počet ľudí" value={operations.plan.plannedCrewCount} onChange={(value) => setPlan('plannedCrewCount', value)} /><Quantity integer label="Skutočný počet ľudí" value={operations.plan.actualCrewCount} onChange={(value) => setPlan('actualCrewCount', value)} /><label>Posádka<select multiple size={Math.max(2, Math.min(workers.length, 5))} value={operations.plan.crewIds} onChange={(event) => setPlan('crewIds', Array.from(event.target.selectedOptions, (option) => option.value))}>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select><small>Vyberte jedného alebo viac pracovníkov.</small></label><Quantity integer label="Plánovaný počet áut" value={operations.plan.plannedVehicleCount} onChange={(value) => setPlan('plannedVehicleCount', value)} /><Quantity integer label="Skutočný počet áut" value={operations.plan.actualVehicleCount} onChange={(value) => setPlan('actualVehicleCount', value)} /><Quantity label="Potvrdená nosnosť vozidiel" unit="kg" value={operations.plan.confirmedCapacityKg} onChange={(value) => setPlan('confirmedCapacityKg', value)} /><label className={styles.full}>Vozidlá – označenia alebo ŠPZ, oddelené čiarkou<input maxLength={8000} value={vehicleText} onChange={(event) => { setVehicleText(event.target.value); setPlan('vehicleIds', event.target.value.split(',').map((value) => value.trim()).filter(Boolean)); }} placeholder="Doplňte konkrétne vozidlá" /></label><Quantity label="Plánovaná vzdialenosť" unit="km" value={operations.plan.plannedKm} onChange={(value) => setPlan('plannedKm', value)} /><Quantity label="Skutočná vzdialenosť" unit="km" value={operations.plan.actualKm} onChange={(value) => setPlan('actualKm', value)} /><label>Vzdialenosť znamená<select value={operations.plan.distanceBasis} onChange={(event) => setPlan('distanceBasis', event.target.value as JobWorkPlan['distanceBasis'])}><option value="UNKNOWN">Zatiaľ neurčené</option><option value="ONE_WAY_FROM_POPRAD">Jedna cesta z Popradu</option><option value="ROUND_TRIP_FROM_POPRAD">Cesta z Popradu aj späť</option></select></label></div>
            <div className={styles.grid}><TriField label="Potrebné lešenie" value={operations.plan.scaffolding} onChange={(value) => setPlan('scaffolding', value)} /><TriField label="Potrebná plošina" value={operations.plan.platform} onChange={(value) => setPlan('platform', value)} /><label>Akcia / dohodnuté podmienky<input maxLength={5000} value={operations.plan.promotionNote} onChange={(event) => setPlan('promotionNote', event.target.value)} /></label><label className={styles.full}>Prístup na miesto, obmedzenia a pokyny<textarea rows={3} maxLength={5000} value={operations.plan.accessNote} onChange={(event) => setPlan('accessNote', event.target.value)} /></label></div>
            <p className={styles.quiet}>Kalendár umožňuje viac zákaziek aj návštev v jeden deň. Zaznačenie termínu v karte samo neobjedná posádku; v plánovači vytvoríte konkrétne akcie a skontrolujete kolízie.</p><div><a className={styles.button} href={`/admin/planovac?zakazka=${card.jobId}${operations.plan.agreedOn || operations.plan.tentativeOn ? `&mesiac=${(operations.plan.agreedOn || operations.plan.tentativeOn)!.slice(0, 7)}` : ''}`}>Otvoriť kalendár zákazky</a></div>
          </div>
        </details>

        {settlement ? <details className={styles.section} id="karta-vyuctovanie" data-tone="violet"><summary><span>Dohoda a skutočné vyúčtovanie<small>Superadmin · evidencia ceny a nákladov, platby sa zapisujú osobitne</small></span></summary><div className={styles.body}><div className={styles.grid}>
          <label>Typ dokladu<select value={settlement.documentType} onChange={(event) => updateSettlement({ ...settlement, documentType: event.target.value as JobWorkspaceSettlement['documentType'] })}><option value="UNDECIDED">Zatiaľ neurčený</option><option value="INVOICE">Faktúra</option><option value="OTHER_DOCUMENT">Iný doklad / bez pripojenej faktúry</option></select></label>
          {([['agreedAmountWithVatCents', 'Dohodnutá cena s DPH'], ['actualAmountWithVatCents', 'Skutočná cena s DPH'], ['plannedCostCents', 'Plánované náklady']] as const).map(([key, label]) => <Quantity label={label} key={key} unit="€" value={settlement[key] === null ? null : settlement[key] / 100} onChange={(value) => updateSettlement({ ...settlement, [key]: value === null ? null : Math.round(value * 100) })} />)}
          <div><strong>Zaúčtované náklady vrátane odmien</strong><p>{settlement.actualCostCents === null ? 'Zatiaľ neurčené' : `${number.format(settlement.actualCostCents / 100)} €`}</p><a href="#udaje-zakazky">Upraviť náklady a odmeny v evidencii</a></div>
          <label className={styles.full}>Poznámka k vyúčtovaniu<textarea rows={3} maxLength={5000} value={settlement.note} onChange={(event) => updateSettlement({ ...settlement, note: event.target.value })} /></label>
        </div><p className={styles.quiet}>Výber faktúry alebo hotovosti nepotvrdzuje prijatie peňazí. Skutočné úhrady a ich opravy evidujete v časti Faktúry a prijaté úhrady.</p></div></details> : null}
      </fieldset>
      {dirty && (card.revision > revision || card.operations.status !== baseStatus) ? <p className={`${styles.message} ${styles.warning}`} role="status">Medzitým pribudla nová verzia zákazky. Vaše rozpracované údaje zostali zachované; pred uložením ich porovnajte s aktuálnou kartou.</p> : null}
      {state.message ? <p className={`${styles.message} ${!state.ok ? styles.warning : ''}`} role={state.ok ? 'status' : 'alert'}>{state.message}{!state.ok ? <> <a href={`/admin/zakazky/${card.jobId}`} target="_blank" rel="noopener">Otvoriť aktuálnu kartu</a></> : null}</p> : null}
      {!archived ? <div className={styles.save}><p>{ready ? 'Uloženie zaznamená autora a čas. Neodosiela ponuku, oznámenie ani fotografiu nezverejní.' : 'Pripravujem pracovnú kartu…'}</p><SaveButton disabled={archived || !ready} /></div> : null}
    </form>

    <div hidden={activeSection !== 'karta-urady'} className="no-print">{authorityNotice}</div>
    <details id="karta-ponuky" className={`${styles.section} no-print`}><summary><span>Ponuky zákazky<small>Pôvodné PDF aj ponuky vytvorené v admine</small></span></summary><div className={styles.body}>{offers ?? <p className={styles.quiet}><a href={`/admin/ponuky?zakazka=${card.jobId}`}>Otvoriť ponuky zákazky</a> · <a href={`/admin/ponuky/nova?zakazka=${card.jobId}`}>Vytvoriť cenovú ponuku</a></p>}</div></details>
    <details id="karta-komunikacia" className={`${styles.section} no-print`} data-tone="violet"><summary><span>Komunikácia a poznámky<small>Overené správy, telefonáty a zákaznícke oznámenia</small></span></summary><div className={styles.body}>{communication ?? <p className={styles.quiet}>Systémové udalosti a poznámky nájdete v časovej osi nižšie.</p>}</div></details>
    <details id="karta-fotky" className={`${styles.section} no-print`} data-tone="teal"><summary><span>Fotky a súkromné doklady<small>Nahrať podklady, priblížiť fotografiu a zachovať originál PDF</small></span></summary><div className={styles.body}>{photos ?? <p className={styles.quiet}><a href={`/admin/zakazky/${card.jobId}/podklady`}>Súkromné podklady zákazky</a></p>}</div></details>
    {paymentSummary}

    <section className={styles.crew} aria-labelledby="crew-card-title">
      <div className={styles.subheading}><h3 id="crew-card-title">Pracovný prehľad pre posádku</h3><button type="button" className={`${styles.button} no-print`} onClick={printCrewCard}>Vytlačiť pre posádku</button></div>
      <p className={styles.quiet}>Prehľad nižšie zobrazuje práve rozpracované údaje. Pred odovzdaním posádke uložte kartu.</p>
      <dl><dt>Zákazka</dt><dd>{card.number} · {customerName}</dd><dt>Miesto</dt><dd>{location || 'Zatiaľ neurčené'}</dd><dt>Druh práce</dt><dd>{workTypeLabels[operations.workType]}</dd><dt>Termín</dt><dd>{operations.plan.agreedOn ? `${operations.plan.agreedOn} · dohodnutý` : operations.plan.tentativeOn ? `${operations.plan.tentativeOn} · predbežný` : 'Zatiaľ neurčený'}{operations.plan.timeFrom ? ` · ${operations.plan.timeFrom} – ${operations.plan.timeTo || '?'}` : ''}</dd><dt>Posádka / autá</dt><dd>{crewNames.join(', ') || 'Posádka neurčená'} · {operations.plan.plannedVehicleCount ?? '?'} áut{operations.plan.vehicleIds.length ? ` · ${operations.plan.vehicleIds.join(', ')}` : ''}</dd><dt>Vzdialenosť</dt><dd>{operations.plan.plannedKm === null ? 'Zatiaľ neurčená' : `${number.format(operations.plan.plannedKm)} km · ${valueLabels[operations.plan.distanceBasis]}`}</dd><dt>Lešenie / plošina</dt><dd>{triLabels[operations.plan.scaffolding]} / {triLabels[operations.plan.platform]}</dd><dt>Prístup</dt><dd>{operations.plan.accessNote || 'Bez doplnených pokynov'}</dd><dt>Poznámka</dt><dd>{operations.note || 'Bez doplnenej poznámky'}</dd></dl>
      {operations.materials.length ? <ul>{operations.materials.map((item) => <li key={item.id}><strong>{item.label || materialLabels[item.kind]}</strong> · plán {item.plannedQuantity === null ? '?' : number.format(item.plannedQuantity)} {unitLabels[item.unit]} · hmotnosť {item.plannedKg === null ? 'neurčená' : `${number.format(item.plannedKg)} kg`}</li>)}</ul> : <p className={styles.quiet}>Materiály a hmotnosti zatiaľ nie sú doplnené.</p>}
    </section>

    <details className={styles.section}><summary><span>História pracovnej karty<small>{timeline.length} zmien s autorom, časom a zachovanou predchádzajúcou hodnotou</small></span></summary><div className={styles.body}><ol className={styles.audit}>{timeline.slice(0, historyLimit).map((event) => <li key={event.id}><strong>{auditLabels[event.action.split('.').at(-1) ?? ''] || 'Úprava karty'}</strong><small>{dateTime.format(new Date(event.recordedAt))} · {event.actorEmail} · revízia {event.revision}</small><details><summary>Zobraziť zmenu</summary><p className={styles.quiet}><strong>Pred zmenou:</strong> {readable(event.changes.before, namedReferences)}</p><p className={styles.quiet}><strong>Po zmene:</strong> {readable(event.changes.after, namedReferences)}</p></details></li>)}</ol>{!timeline.length ? <p className={styles.quiet}>Zatiaľ bez uložených zmien.</p> : null}{timeline.length > historyLimit ? <button type="button" className={styles.button} onClick={() => setHistoryLimit((limit) => limit + 30)}>Zobraziť ďalšie zmeny</button> : null}</div></details>
  </div>;
}
