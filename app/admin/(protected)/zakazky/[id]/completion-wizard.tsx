import type { AdminRole, BusinessJobCompletion, BusinessJobStatus, OperationalBusinessJobCompletion } from '@/src/server/types';
import { finalizeBusinessJobCompletionAction, saveBusinessJobCompletionAction } from '../actions';

type CommonProps = {
  jobId: string;
  jobStatus: BusinessJobStatus;
  csrfToken: string;
  isArchived: boolean;
  isTestData: boolean;
  notice?: string;
};

type Props = CommonProps & (
  | { role: Extract<AdminRole, 'SUPER_ADMIN'>; completion: BusinessJobCompletion }
  | { role: Exclude<AdminRole, 'SUPER_ADMIN'>; completion: OperationalBusinessJobCompletion }
);

const decisionLabels = {
  documents: {
    pending: 'Treba skontrolovať',
    confirmed: 'Doklady sú skontrolované',
    not_applicable: 'Nevzťahuje sa na túto zákazku',
  },
  costs: {
    pending: 'Treba skontrolovať',
    confirmed_recorded: 'Náklady sú zaevidované',
    confirmed_zero: 'Oprávnene bez nákladov',
  },
  photos: {
    pending: 'Treba rozhodnúť',
    waiting: 'Čakáme na fotografie',
    not_available: 'Fotografie nebudú k dispozícii',
    ready_private: 'Schválené súkromné fotografie sú pripravené',
  },
  review: {
    pending: 'Treba rozhodnúť',
    prepare: 'Pripraviť koncept žiadosti',
    blocked: 'Zákazníka neoslovovať',
  },
} as const;

export default function CompletionWizard({
  completion, jobId, jobStatus, role, csrfToken, isArchived, isTestData, notice,
}: Props) {
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isLegacyCompleted = jobStatus === 'DOKONCENA' && !completion.finalizedAt;
  const canEdit = !isArchived && !isTestData && !completion.finalizedAt
    && (jobStatus === 'DEMONT_DOKONCENA' || jobStatus === 'VYUCTOVANIE');
  const decisionsReady = isSuperAdmin
    && completion.documentsDecision !== 'pending'
    && (completion.documentsDecision !== 'not_applicable' || completion.documentsReason.trim().length >= 3)
    && completion.costsDecision !== 'pending'
    && (completion.costsDecision !== 'confirmed_zero' || completion.costsReason.trim().length >= 3)
    && !['pending', 'waiting'].includes(completion.photosDecision)
    && (completion.photosDecision !== 'not_available' || completion.photosReason.trim().length >= 3)
    && completion.reviewDecision !== 'pending'
    && (completion.reviewDecision !== 'blocked' || completion.reviewBlockReason.trim().length >= 3);

  return (
    <section className="admin-card completion-wizard no-print" id="dokoncovanie" aria-labelledby="completion-wizard-title">
      <div className="ops-section-heading">
        <div><span>Riadené uzavretie</span><h2 id="completion-wizard-title">Sprievodca dokončením zákazky</h2></div>
        <p>Operátor pripraví podklady. Superadmin skontroluje financie a zákazku finálne uzavrie.</p>
      </div>

      {notice === 'saved' ? <p className="completion-notice is-success" role="status">Kontroly sú uložené. Nič sa zákazníkovi neodoslalo.</p> : null}
      {notice === 'finalized' ? <p className="completion-notice is-success" role="status">Zákazka je uzavretá. Prípadná žiadosť o referenciu je iba pripravená na samostatné schválenie.</p> : null}
      {isTestData ? <p className="completion-notice is-warning">Testovaciu zákazku nemožno týmto sprievodcom uzavrieť ani použiť na oslovenie zákazníka.</p> : null}
      {isLegacyCompleted ? <p className="completion-notice">Táto zákazka bola dokončená starším postupom. Záznam zostáva zachovaný bez spätnej zmeny.</p> : null}
      {completion.finalizedAt ? <p className="completion-notice is-success">Uzavreté {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(completion.finalizedAt))}. Ďalšie kroky s referenciou sa robia v pracovisku Referencie a hodnotenia.</p> : null}

      {canEdit ? <form action={saveBusinessJobCompletionAction} className="completion-wizard-form">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="revision" value={completion.revision} />

        <fieldset className="completion-step">
          <legend><span>1</span><strong>Doklady a administratíva</strong></legend>
          <p>Potvrďte, že sú uložené všetky potrebné pracovné doklady, alebo zaznamenajte, prečo sa na zákazku nevzťahujú.</p>
          <label>Výsledok kontroly
            <select name="documentsDecision" defaultValue={completion.documentsDecision}>
              {Object.entries(decisionLabels.documents).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Poznámka pri výnimke
            <textarea name="documentsReason" rows={2} maxLength={500} defaultValue={completion.documentsReason} placeholder="Povinné, ak sa doklady na zákazku nevzťahujú." />
          </label>
        </fieldset>

        <fieldset className="completion-step">
          <legend><span>2</span><strong>Náklady a vyúčtovanie</strong></legend>
          {isSuperAdmin ? <>
            <p>Skontrolujte zaevidované náklady. Nulové náklady musia byť výslovne potvrdené, nie iba ponechané prázdne.</p>
            <label>Výsledok finančnej kontroly
              <select name="costsDecision" defaultValue={completion.costsDecision}>
                {Object.entries(decisionLabels.costs).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Dôvod pri nulových nákladoch
              <textarea name="costsReason" rows={2} maxLength={500} defaultValue={completion.costsReason} placeholder="Povinné pri voľbe „Oprávnene bez nákladov“." />
            </label>
          </> : <>
            <p className="completion-role-note">Finančnú kontrolu dokončí superadmin. Operátorský účet nevidí ani nemení finančné hodnoty.</p>
          </>}
        </fieldset>

        <fieldset className="completion-step">
          <legend><span>3</span><strong>Súkromná fotodokumentácia</strong></legend>
          <p>Fotky zostávajú súkromné. Označenie „pripravené“ iba potvrdzuje interné schválenie, nie publikovanie na webe.</p>
          <label>Stav fotografií
            <select name="photosDecision" defaultValue={completion.photosDecision}>
              {Object.entries(decisionLabels.photos).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Dôvod, ak fotografie nebudú
            <textarea name="photosReason" rows={2} maxLength={500} defaultValue={completion.photosReason} placeholder="Povinné pri voľbe „Fotografie nebudú k dispozícii“." />
          </label>
          <a className="admin-secondary-link" href={`/admin/zakazky/${jobId}/podklady`}>Skontrolovať podklady a fotografie</a>
        </fieldset>

        <fieldset className="completion-step">
          <legend><span>4</span><strong>Referencia zákazníka</strong></legend>
          <p>Voľba „pripraviť“ vytvorí iba koncept. Odoslanie emailu aj publikovanie referencie vyžaduje samostatnú ľudskú kontrolu.</p>
          <label>Ďalší krok
            <select name="reviewDecision" defaultValue={completion.reviewDecision}>
              {Object.entries(decisionLabels.review).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Dôvod, prečo zákazníka neosloviť
            <textarea name="reviewBlockReason" rows={2} maxLength={500} defaultValue={completion.reviewBlockReason} placeholder="Povinné pri voľbe „Zákazníka neoslovovať“." />
          </label>
        </fieldset>

        <div className="completion-actions">
          <button className="admin-primary-button" type="submit">Uložiť kontroly</button>
          <span>Uloženie nemení stav na dokončenú a nič neodosiela.</span>
        </div>
      </form> : null}

      {canEdit && isSuperAdmin ? <form action={finalizeBusinessJobCompletionAction} className="completion-finalize">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="revision" value={completion.revision} />
        <div>
          <strong>Finálne uzavretie</strong>
          <p>Najprv uložte všetky štyri kontroly. Systém potom ešte raz overí aktuálnu verziu a dôkazy.</p>
          <p><strong>Uzavrie zákazku a prípadne pripraví koncept. Nič sa neodošle ani nezverejní.</strong></p>
        </div>
        <label className="admin-check-label"><input type="checkbox" name="confirmed" required /> Skontroloval/a som konkrétnu zákazku a potvrdzujem jej uzavretie.</label>
        <button className="admin-primary-button" type="submit" disabled={!decisionsReady}>Označiť zákazku ako dokončenú</button>
        {!decisionsReady ? <small>Finálne tlačidlo sa sprístupní až po uložení všetkých rozhodnutí.</small> : null}
      </form> : null}
    </section>
  );
}
