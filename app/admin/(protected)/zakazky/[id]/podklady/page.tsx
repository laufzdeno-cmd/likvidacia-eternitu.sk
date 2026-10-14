import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/src/server/auth';
import { getBusinessJobFinance, getBusinessJobWithActivity, getOperationalBusinessJobWithActivity, listBusinessJobOfferEvidence, listPlannerActions, listPriceOffers } from '@/src/server/db';
import { euro, jobStatusLabels, landfillLabels, workTypeLabels } from '../../constants';
import { priceOfferStatusLabels } from '../../../ponuky/constants';
import PrintButton from '../../../planovac/print-button';
import type { BusinessJob, BusinessJobOfferEvidence, OperationalBusinessJob, PriceOffer } from '@/src/server/types';

type DocumentKey = 'all' | 'ponuka' | 'pracovny-list' | 'ruvz' | 'odpad' | 'protokol' | 'vyuctovanie';
type OfferEvidence = PriceOffer | BusinessJobOfferEvidence;

const operationalDocumentKeys = new Set<DocumentKey>(['all', 'ponuka', 'pracovny-list', 'ruvz', 'odpad', 'protokol']);
const invoiceStatusLabels = { CANCELLED: 'Stornovaná', UNPAID: 'Neuhradená', PARTIALLY_PAID: 'Čiastočne uhradená', PAID: 'Uhradená', OVERPAID: 'Preplatok', OVERDUE: 'Po splatnosti' } as const;
const paymentMethodLabels = { BANK_TRANSFER: 'Bankový prevod', CASH: 'Hotovosť', CARD: 'Karta', OTHER: 'Iné' } as const;

function dateSk(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeZone: 'Europe/Bratislava' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function isFinancialBusinessJob(job: BusinessJob | OperationalBusinessJob): job is BusinessJob {
  return 'totalPrice' in job && typeof job.totalPrice === 'number';
}

function offerValidUntil(offer?: OfferEvidence) {
  return offer && 'validUntil' in offer ? offer.validUntil : '';
}

function isFullPriceOffer(offer?: OfferEvidence): offer is PriceOffer {
  return Boolean(offer && 'totalWithVat' in offer && typeof offer.totalWithVat === 'number');
}

export default async function JobDocumentPackPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dokument?: string }>;
}) {
  const [{ id }, query, adminUser] = await Promise.all([params, searchParams, requireAdminUser()]);
  const isSuperAdmin = adminUser.role === 'SUPER_ADMIN';
  const requested = query.dokument as DocumentKey | undefined;
  if (requested === 'vyuctovanie' && !isSuperAdmin) notFound();
  const selectedDocument: DocumentKey = requested && (operationalDocumentKeys.has(requested) || (isSuperAdmin && requested === 'vyuctovanie')) ? requested : 'all';
  const show = (key: Exclude<DocumentKey, 'all'>) => selectedDocument === 'all' || selectedDocument === key;
  const job = isSuperAdmin ? await getBusinessJobWithActivity(id) : await getOperationalBusinessJobWithActivity(id);
  if (!job || (job.deletedAt && !isSuperAdmin)) notFound();
  const planningEnd = new Date(`${job.demolitionDate}T12:00:00Z`);
  planningEnd.setUTCDate(planningEnd.getUTCDate() + 365);
  const [finance, offers, plannerActions] = await Promise.all([
    isSuperAdmin ? getBusinessJobFinance(id) : Promise.resolve(null),
    isSuperAdmin ? listPriceOffers({ jobId: id, includeArchived: true }) : listBusinessJobOfferEvidence(id),
    listPlannerActions({ from: job.createdAt.slice(0, 10), to: planningEnd.toISOString().slice(0, 10) }),
  ]);
  const jobActions = plannerActions.filter((action) => action.jobId === job.id);
  const acceptedOffer = offers.find((offer) => !offer.deletedAt && offer.status === 'PRIJATA');
  const linkedOffer = acceptedOffer || offers.find((offer) => !offer.deletedAt);
  const generatedAt = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date());

  return (
    <main className="admin-page ops-page document-pack">
      <div className="admin-heading no-print ops-heading">
        <div><p>Bezpečné pracovné návrhy</p><h1>Balík podkladov zákazky</h1><span>Každý podklad možno otvoriť a vytlačiť samostatne. Pred použitím ho musí skontrolovať zodpovedná osoba.</span></div>
        <div className="admin-action-row"><a className="admin-secondary-link" href={`/admin/zakazky/${job.id}`}>Späť na zákazku</a><PrintButton label="Tlačiť / uložiť PDF" /></div>
      </div>

      <section className="ops-alert ops-alert-warning no-print">
        <div><span>Dôležité</span><h2>Návrhy sa nikam automaticky neodosielajú</h2></div>
        <p>Tlač vytvorí iba lokálny pracovný podklad. Systém nepotvrdzuje právnu úplnosť ani splnenie povinnosti voči RÚVZ, odpadovej spoločnosti alebo zákazníkovi.</p>
      </section>

      <nav className="document-pack-nav no-print" aria-label="Výber dokumentu">
        <a className={selectedDocument === 'all' ? 'is-active' : ''} href={`/admin/zakazky/${job.id}/podklady`}>Celý balík</a>
        <a className={selectedDocument === 'ponuka' ? 'is-active' : ''} href="?dokument=ponuka">Väzba na CP</a>
        <a className={selectedDocument === 'pracovny-list' ? 'is-active' : ''} href="?dokument=pracovny-list">Pracovný list</a>
        <a className={selectedDocument === 'ruvz' ? 'is-active' : ''} href="?dokument=ruvz">Podklady RÚVZ</a>
        <a className={selectedDocument === 'odpad' ? 'is-active' : ''} href="?dokument=odpad">Evidencia zneškodnenia</a>
        <a className={selectedDocument === 'protokol' ? 'is-active' : ''} href="?dokument=protokol">Odovzdávací protokol</a>
        {isSuperAdmin ? <a className={selectedDocument === 'vyuctovanie' ? 'is-active' : ''} href="?dokument=vyuctovanie">Vyúčtovanie</a> : null}
      </nav>

      <header className="document-pack-cover">
        <img src="/assets/astana-logo.png" alt="ASTANA" />
        <div><span>PRACOVNÝ NÁVRH · {job.id.slice(0, 8).toUpperCase()}</span><h2>{job.customerName}</h2><p>{job.location}{job.district ? ` · okres ${job.district}` : ''}</p></div>
        <small>Vygenerované {generatedAt}</small>
      </header>

      {selectedDocument === 'all' ? <>
        <section className="document-pack-grid">
          <article className="admin-card">
            <h2>Základné údaje</h2>
            <dl className="ops-definition-list">
              <div><dt>Zákazník</dt><dd>{job.customerName}</dd></div><div><dt>Telefón</dt><dd>{job.customerPhone || '—'}</dd></div>
              <div><dt>Email</dt><dd>{job.customerEmail || '—'}</dd></div><div><dt>Miesto</dt><dd>{job.location}</dd></div>
              <div><dt>Objekt</dt><dd>{job.objectType || '—'}</dd></div><div><dt>Materiál</dt><dd>{job.materialType || '—'}</dd></div>
              <div><dt>Rozsah</dt><dd>{job.m2} m² · {workTypeLabels[job.workType]}</dd></div><div><dt>CRM stav</dt><dd>{jobStatusLabels[job.status]}</dd></div>
            </dl>
          </article>
          <article className="admin-card">
            <h2>Kontrolný súhrn</h2>
            <dl className="ops-definition-list">
              <div><dt>Väzba na CP</dt><dd>{linkedOffer ? `${linkedOffer.number} · ${priceOfferStatusLabels[linkedOffer.status]}` : 'chýba'}</dd></div>
              <div><dt>Demontáž</dt><dd>{dateSk(job.demolitionDate)}</dd></div><div><dt>Skládka</dt><dd>{landfillLabels[job.landfill]}</dd></div>
              <div><dt>Evidovaná hmotnosť</dt><dd>{job.wasteKg ? `${job.wasteKg} kg` : 'doplniť po realizácii'}</dd></div>
              {finance && isFinancialBusinessJob(job) ? <><div><dt>Fakturované</dt><dd>{euro(finance.activeInvoicedCents / 100)}</dd></div><div><dt>Neuhradené</dt><dd>{euro(finance.outstandingCents / 100)}</dd></div></> : null}
            </dl>
          </article>
        </section>
        <section className="admin-card document-pack-section">
          <h2>Harmonogram a tím</h2>
          <table className="admin-table"><thead><tr><th>Dátum</th><th>Čas</th><th>Akcia</th><th>Adresa</th><th>Tím</th><th>Stav</th></tr></thead><tbody>
            {jobActions.map((action) => <tr key={action.id}><td>{dateSk(action.date)}</td><td>{action.timeFrom}–{action.timeTo}</td><td>{action.type}</td><td>{action.address}</td><td>{action.workers || '—'}</td><td>{action.status}</td></tr>)}
            {!jobActions.length ? <tr><td colSpan={6}>Termín ešte nie je naplánovaný.</td></tr> : null}
          </tbody></table>
        </section>
      </> : null}

      {show('ponuka') ? <section className="admin-card document-sheet" id="cenova-ponuka">
        <div className="document-sheet-heading"><div><span>DOKUMENT 1 · INTERNÁ VÄZBA</span><h2>Cenová ponuka zákazky</h2></div><strong>{linkedOffer ? linkedOffer.number : 'CP NIE JE PRIRADENÁ'}</strong></div>
        <p className="document-warning">Toto je tlačiteľný kontrolný súhrn, nie nová cenová ponuka. Autoritatívnym dokumentom zostáva existujúce PDF CP v CRM; súhrn sa nikam automaticky neodosiela.</p>
        <dl className="ops-definition-list">
          <div><dt>Číslo CP</dt><dd>{linkedOffer?.number || 'DOPLNIŤ / vytvoriť cenovú ponuku'}</dd></div><div><dt>Stav v CRM</dt><dd>{linkedOffer ? priceOfferStatusLabels[linkedOffer.status] : 'Neevidovaná'}</dd></div>
          <div><dt>Platnosť do</dt><dd>{offerValidUntil(linkedOffer) ? dateSk(offerValidUntil(linkedOffer)) : 'Údaj nie je v operatívnom pohľade dostupný'}</dd></div><div><dt>Zákazka</dt><dd>{job.customerName} · {job.location}</dd></div>
        </dl>
        {isSuperAdmin && isFullPriceOffer(linkedOffer) ? <>
          <h3 className="document-subheading">Kontrolný súhrn obsahu existujúcej CP</h3>
          <div className="document-form-grid">
            <p><span>Kontaktná osoba</span><strong>{linkedOffer.contactPerson}</strong></p><p><span>Miesto realizácie</span><strong>{linkedOffer.objectAddress || linkedOffer.municipality}</strong></p>
            <p><span>Objekt a materiál</span><strong>{linkedOffer.objectType} · {linkedOffer.materialType}</strong></p><p><span>Výmera</span><strong>{linkedOffer.areaM2} m²</strong></p>
            <p><span>Dokumentácia v ponuke</span><strong>{linkedOffer.includeDocumentation ? 'Áno' : 'Nie'}</strong></p><p><span>Doprava v ponuke</span><strong>{linkedOffer.includeTransport ? 'Áno' : 'Nie'}</strong></p>
            <p><span>Celkom bez DPH</span><strong>{euro(linkedOffer.totalWithoutVat)}</strong></p><p><span>Celkom s DPH</span><strong>{euro(linkedOffer.totalWithVat)}</strong></p>
            <p className="document-form-wide"><span>Poznámka uvedená v CP</span><strong>{linkedOffer.offerNote || 'Bez poznámky'}</strong></p>
          </div>
        </> : null}
        <div className="document-actions no-print">{isSuperAdmin && linkedOffer ? <a className="admin-primary-link" href={`/api/admin/ponuka/${linkedOffer.id}/pdf`} target="_blank" rel="noreferrer">Otvoriť existujúce PDF CP</a> : null}<a className="admin-secondary-link" href={`/admin/ponuky?jobId=${job.id}`}>Otvoriť evidenciu ponúk</a></div>
        {!isSuperAdmin ? <p className="admin-muted-note">Obsah a finančné údaje CP môže otvoriť superadmin. Operátor vidí iba bezpečnú väzbu a stav dokumentu.</p> : null}
        <div className="document-signatures"><p>Správnu verziu overil/a: ____________________</p><p>Dátum kontroly: ____________________</p><p>Podpis: ____________________</p></div>
      </section> : null}

      {show('pracovny-list') ? <section className="admin-card document-sheet" id="pracovny-list">
        <div className="document-sheet-heading"><div><span>DOKUMENT 2 · OPERATÍVNY ZÁZNAM</span><h2>Pracovný list realizácie</h2></div><strong>VYPLNIŤ NA MIESTE</strong></div>
        <p className="document-warning">Pracovný list slúži tímu na zaznamenanie skutočného priebehu. Nenahrádza úradné podklady, odpadové doklady, cenovú ponuku ani odovzdávací protokol.</p>
        <div className="document-form-grid">
          <p><span>Zákazka / objednávateľ</span><strong>{job.customerName}</strong></p><p><span>Miesto prác</span><strong>{job.location}</strong></p>
          <p><span>Kontakt na mieste</span><strong>{job.customerPhone || 'DOPLNIŤ'}</strong></p><p><span>Vedúci tímu</span><strong>________________________________</strong></p>
          <p><span>Plánovaný dátum</span><strong>{dateSk(job.demolitionDate)}</strong></p><p><span>Skutočný príchod / odchod</span><strong>________ : ________ / ________ : ________</strong></p>
          <p><span>Plánovaný tím</span><strong>{job.workers.map((worker) => worker.workerName).join(', ') || 'DOPLNIŤ'}</strong></p><p><span>Skutočný tím</span><strong>________________________________</strong></p>
          <p><span>Plánovaný rozsah</span><strong>{workTypeLabels[job.workType]} · {job.m2 || '—'} m²</strong></p><p><span>Skutočný rozsah</span><strong>________________ m² / ________________________________</strong></p>
          <p><span>Materiál / objekt</span><strong>{job.materialType || 'DOPLNIŤ'} · {job.objectType || 'DOPLNIŤ'}</strong></p><p><span>Odpad – priebežný odhad</span><strong>________________ kg</strong></p>
          <p className="document-form-wide"><span>Zmeny oproti zadaniu, prekážky alebo mimoriadne udalosti</span><strong>________________________________________________________________________________<br />________________________________________________________________________________<br />________________________________________________________________________________</strong></p>
        </div>
        <div className="document-checks">{['Miesto a rozsah boli pred začatím overené s kontaktnou osobou.', 'Tím použil určené ochranné pracovné prostriedky a zabezpečil pracovisko.', 'Materiál bol počas práce bezpečne zvlhčovaný, balený a označený podľa schváleného postupu.', 'Zmeny rozsahu neboli vykonané bez zaznamenania a odsúhlasenia zodpovednou osobou.', 'Súkromná fotodokumentácia pred/po bola uložená na schválenie.', 'Odpad, doklady a ďalší krok sú odovzdané zodpovednej osobe.'].map((label) => <p key={label}><span aria-hidden="true">☐</span>{label}</p>)}</div>
        <div className="document-signatures"><p>Vedúci tímu: ____________________</p><p>Členovia tímu: ____________________</p><p>Dátum a podpis: ____________________</p></div>
      </section> : null}

      {show('ruvz') ? <section className="admin-card document-sheet" id="ruvz">
        <div className="document-sheet-heading"><div><span>DOKUMENT 3 · NÁVRH NA ODBORNÚ KONTROLU</span><h2>Pracovné podklady pre oznámenie RÚVZ</h2></div><strong>NIE JE PODANIE</strong></div>
        <p className="document-warning">Ide o predvyplnený pracovný návrh. Pred podaním treba overiť príslušný orgán, lehotu, aktuálne zákonné náležitosti, oprávnenia a povinné prílohy. Systém nič neodosiela.</p>
        <div className="document-form-grid">
          <p><span>Objednávateľ</span><strong>{job.customerName}</strong></p><p><span>Miesto prác</span><strong>{job.location}</strong></p><p><span>Kontakt</span><strong>{job.customerPhone || '—'} · {job.customerEmail || '—'}</strong></p><p><span>Okres</span><strong>{job.district || 'DOPLNIŤ'}</strong></p>
          <p><span>Predmet prác</span><strong>{workTypeLabels[job.workType]} · {job.objectType || 'objekt doplniť'}</strong></p><p><span>Materiál a rozsah</span><strong>{job.materialType || 'DOPLNIŤ'} · {job.m2 || '—'} m²</strong></p><p><span>Predpokladaný termín</span><strong>{dateSk(job.demolitionDate)}</strong></p><p><span>Pracovný tím</span><strong>{job.workers.map((worker) => worker.workerName).join(', ') || 'DOPLNIŤ'}</strong></p>
          <p><span>Príslušný RÚVZ</span><strong>________________________________</strong></p><p><span>Dátum / spôsob podania</span><strong>________________________________</strong></p><p><span>Číslo spisu / potvrdenia</span><strong>________________________________</strong></p><p><span>Zodpovedná osoba</span><strong>________________________________</strong></p>
        </div>
        <div className="document-checks">{['Overiť vecne a miestne príslušný RÚVZ.', 'Overiť aktuálnu lehotu a formu oznámenia/podania.', 'Priložiť iba aktuálne a odborne skontrolované oprávnenia a pracovný postup.', 'Overiť BOZP, ochranné opatrenia a osobu zodpovednú za práce.', 'Zaevidovať dôkaz podania a odpoveď úradu v CRM.'].map((label) => <p key={label}><span aria-hidden="true">☐</span>{label}</p>)}</div>
        <div className="document-signatures"><p>Odborne skontroloval/a: ____________________</p><p>Dátum: ____________________</p><p>Podpis: ____________________</p></div>
      </section> : null}

      {show('odpad') ? <section className="admin-card document-sheet" id="zneškodnenie">
        <div className="document-sheet-heading"><div><span>DOKUMENT 4 · PRACOVNÁ EVIDENCIA</span><h2>Prehľad zneškodnenia a odovzdania odpadu</h2></div><strong>DOPLNIŤ PODĽA DOKLADOV</strong></div>
        <p className="document-warning">Tento prehľad nie je vážny lístok, sprievodný list ani potvrdenie oprávneného príjemcu. Údaje potvrďte podľa skutočných dokladov a uchovajte ich v zákazke.</p>
        <div className="document-form-grid">
          <p><span>Zákazka / miesto</span><strong>{job.customerName} · {job.location}</strong></p><p><span>Dátum realizácie</span><strong>{dateSk(job.demolitionDate)}</strong></p><p><span>Materiál</span><strong>{job.materialType || 'DOPLNIŤ'}</strong></p><p><span>Katalógové číslo odpadu</span><strong>________________________________</strong></p>
          <p><span>Evidovaná hmotnosť v CRM</span><strong>{job.wasteKg ? `${job.wasteKg} kg` : 'DOPLNIŤ'}</strong></p><p><span>Skutočná hmotnosť podľa dokladu</span><strong>________________ kg</strong></p><p><span>Plánované miesto odovzdania</span><strong>{landfillLabels[job.landfill]}</strong></p><p><span>Skutočný príjemca odpadu</span><strong>________________________________</strong></p>
          <p><span>Dopravca / vozidlo / EČV</span><strong>________________________________</strong></p><p><span>Číslo vážneho alebo odovzdávacieho dokladu</span><strong>________________________________</strong></p><p><span>Dátum a čas odovzdania</span><strong>________________________________</strong></p><p><span>Doklad uložený v zákazke</span><strong>☐ áno &nbsp; ☐ nie</strong></p>
        </div>
        <div className="document-signatures"><p>Zapísal/a: ____________________</p><p>Dátum kontroly: ____________________</p><p>Podpis: ____________________</p></div>
      </section> : null}

      {show('protokol') ? <section className="admin-card document-sheet" id="protokol">
        <div className="document-sheet-heading"><div><span>DOKUMENT 5 · NÁVRH NA OBOJSTRANNÚ KONTROLU</span><h2>Odovzdávací protokol a záverečný checklist</h2></div><strong>NEPODPÍSANÝ NÁVRH</strong></div>
        <p className="document-warning">Protokol sa považuje za potvrdený až po kontrole skutočného rozsahu a podpise oprávnených osôb. Vygenerovanie ani tlač dokument automaticky neposiela zákazníkovi.</p>
        <div className="document-form-grid">
          <p><span>Objednávateľ</span><strong>{job.customerName}</strong></p><p><span>Zhotoviteľ</span><strong>ASTANA · identifikačné údaje overiť podľa zmluvných podkladov</strong></p><p><span>Miesto vykonania</span><strong>{job.location}</strong></p><p><span>Dátum odovzdania</span><strong>________________________________</strong></p>
          <p><span>Dohodnutý rozsah</span><strong>{workTypeLabels[job.workType]} · {job.m2 || '—'} m²</strong></p><p><span>Skutočne vykonaný rozsah</span><strong>________________________________</strong></p><p className="document-form-wide"><span>Poznámky, výhrady a nedorobky</span><strong>________________________________________________________________________________<br />________________________________________________________________________________</strong></p>
        </div>
        <div className="document-checks">{['Rozsah a viditeľný výsledok prác boli spoločne skontrolované.', 'Miesto bolo odovzdané v dohodnutom stave.', 'Fotodokumentácia bola uložená iba v schválenom súkromnom režime.', 'Doklady k odovzdaniu odpadu boli doplnené alebo je zapísaný termín ich dodania.', 'Prípadné výhrady, termín nápravy a zodpovedná osoba sú zapísané vyššie.', 'Kontaktné a fakturačné kroky boli vysvetlené bez automatického odoslania dokumentov.'].map((label) => <p key={label}><span aria-hidden="true">☐</span>{label}</p>)}</div>
        <div className="document-signatures"><p>Za objednávateľa<br /><br />Meno: ____________________<br /><br />Podpis: ____________________</p><p>Za zhotoviteľa<br /><br />Meno: ____________________<br /><br />Podpis: ____________________</p><p>Dátum a miesto<br /><br />____________________<br /><br />____________________</p></div>
      </section> : null}

      {isSuperAdmin && finance && isFinancialBusinessJob(job) && show('vyuctovanie') ? <section className="admin-card document-sheet document-settlement" id="vyuctovanie">
        <div className="document-sheet-heading"><div><span>DOKUMENT 6 · LEN SUPERADMIN</span><h2>Interný prehľad vyúčtovania zákazky</h2></div><strong>{finance.requiresReview ? 'VYŽADUJE KONTROLU' : 'PODĽA EVIDENCIE CRM'}</strong></div>
        <p className="document-warning">Toto nie je faktúra, účtovná závierka ani potvrdenie o zaplatení. Prehľad zobrazuje iba skutočne zaevidované doklady, úhrady a interné náklady. Chýbajúci záznam sa nepovažuje za nulu ani za splnenie povinnosti.</p>
        <div className="document-finance-summary">
          <article><span>Aktívne fakturované</span><strong>{euro(finance.activeInvoicedCents / 100)}</strong></article>
          <article><span>Prijaté úhrady netto</span><strong>{euro(finance.netReceivedCents / 100)}</strong></article>
          <article><span>Zostáva podľa evidencie</span><strong>{euro(finance.outstandingCents / 100)}</strong></article>
          <article><span>Po splatnosti</span><strong>{euro(finance.overdueCents / 100)}</strong></article>
        </div>
        {finance.unallocatedReceivedCents || finance.overpaidCents ? <p className="document-warning">Na manuálnu kontrolu: nepriradené úhrady {euro(finance.unallocatedReceivedCents / 100)} · preplatky {euro(finance.overpaidCents / 100)}.</p> : null}

        <h3 className="document-subheading">Evidované faktúry</h3>
        <div className="admin-table-wrap" role="region" aria-label="Evidované faktúry" tabIndex={0}>
          <table className="admin-table"><thead><tr><th>Faktúra</th><th>Vystavená</th><th>Splatnosť</th><th>Suma s DPH</th><th>Prijaté</th><th>Zostáva</th><th>Stav</th></tr></thead><tbody>
            {finance.invoices.map((invoice) => {
              const balance = finance.invoiceBalances.find((item) => item.invoiceId === invoice.id);
              return <tr key={invoice.id}><td>{invoice.invoiceNumber}</td><td>{dateSk(invoice.issuedOn)}</td><td>{dateSk(invoice.dueOn || '')}</td><td>{euro(invoice.amountWithVatCents / 100)}</td><td>{euro((balance?.receivedCents || 0) / 100)}</td><td>{euro((balance?.outstandingCents || 0) / 100)}</td><td>{balance ? invoiceStatusLabels[balance.status] : 'Na kontrolu'}{invoice.cancelledAt ? ' · storno' : ''}</td></tr>;
            })}
            {!finance.invoices.length ? <tr><td colSpan={7}>V CRM nie je zaevidovaná žiadna faktúra. To nepotvrdzuje, že faktúra neexistuje mimo systému.</td></tr> : null}
          </tbody></table>
        </div>

        <h3 className="document-subheading">Evidované úhrady a opravy</h3>
        <div className="admin-table-wrap" role="region" aria-label="Evidované úhrady" tabIndex={0}>
          <table className="admin-table"><thead><tr><th>Dátum</th><th>Udalosť</th><th>Faktúra</th><th>Suma</th><th>Spôsob</th><th>Referencia</th></tr></thead><tbody>
            {finance.paymentEvents.map((event) => <tr key={event.id}><td>{dateSk(event.occurredOn)}</td><td>{event.eventType === 'RECEIPT' ? 'Prijatá úhrada' : 'Storno úhrady'}</td><td>{finance.invoices.find((invoice) => invoice.id === event.invoiceId)?.invoiceNumber || 'Nepriradená'}</td><td>{event.eventType === 'REVERSAL' ? '−' : ''}{euro(event.amountCents / 100)}</td><td>{paymentMethodLabels[event.method]}</td><td>{event.reference || event.reasonCode || '—'}</td></tr>)}
            {!finance.paymentEvents.length ? <tr><td colSpan={6}>V CRM nie je zaevidovaná žiadna úhrada ani opravná udalosť.</td></tr> : null}
          </tbody></table>
        </div>

        <h3 className="document-subheading">Interné prevádzkové vstupy</h3>
        <div className="document-form-grid">
          <p><span>Evidovaná obchodná suma zákazky</span><strong>{euro(job.totalPrice)}</strong></p><p><span>Priame náklady spolu</span><strong>{euro(job.costs.total)}</strong></p>
          <p><span>Palivo</span><strong>{euro(job.costs.fuel)}</strong></p><p><span>Skládka</span><strong>{euro(job.costs.landfillCost)}</strong></p>
          <p><span>Obleky / rukavice / penetrácia</span><strong>{euro(job.costs.suits + job.costs.gloves + job.costs.penetrant)}</strong></p><p><span>Ostatné náklady</span><strong>{job.costs.otherName || 'Bez popisu'} · {euro(job.costs.otherAmount)}</strong></p>
          <p><span>Evidované odmeny</span><strong>{euro(job.rewardsTotal)}</strong></p><p><span>Orientačný prevádzkový rozdiel</span><strong>{euro(job.grossProfit)}</strong></p>
        </div>
        <p className="admin-muted-note">Orientačný prevádzkový rozdiel vychádza z evidovanej obchodnej sumy, zadaných priamych nákladov a odmien. Nie je to účtovný ani daňový zisk a môže byť neúplný.</p>
        <div className="document-signatures"><p>Skontroloval/a doklady: ____________________</p><p>Dátum kontroly: ____________________</p><p>Podpis: ____________________</p></div>
      </section> : null}

      <footer className="document-pack-footer">Interné pracovné návrhy ASTANA · nevzniká automatické podanie, odoslanie, prevzatie ani právne potvrdenie.</footer>
    </main>
  );
}
