'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  adminDraftLabels as labels,
  makeDeterministicAdminDraft,
  type AdminDraftType as DraftType,
} from '@/src/lib/admin-draft';
import { generateAdminAiDraftAction, initialAdminAiDraftState } from './actions';

export default function DraftComposer({
  csrfToken,
  providerReady,
}: {
  csrfToken: string;
  providerReady: boolean;
}) {
  const [type, setType] = useState<DraftType>('summary');
  const [name, setName] = useState('');
  const [locality, setLocality] = useState('');
  const [facts, setFacts] = useState('');
  const [copied, setCopied] = useState(false);
  const [aiState, aiAction, aiPending] = useActionState(generateAdminAiDraftAction, initialAdminAiDraftState);
  const requestKey = JSON.stringify({ type, name: name.trim(), locality: locality.trim(), facts: facts.trim() });
  const localDraft = useMemo(
    () => makeDeterministicAdminDraft(type, name, locality, facts),
    [type, name, locality, facts],
  );
  const draft = aiState.ok && aiState.requestKey === requestKey ? aiState.draft : localDraft;

  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  return (
    <form className="draft-composer" action={aiAction}>
      <input type="hidden" name="_csrf" value={csrfToken} />

      <section className="admin-card draft-inputs">
        <header>
          <div>
            <p>Ručne spúšťaný návrh</p>
            <h2>Pripraviť návrh</h2>
          </div>
          <span className="draft-mode-badge">{providerReady ? 'AI + lokálna záloha' : 'Lokálna šablóna'}</span>
        </header>

        <label>
          Typ návrhu
          <select name="type" value={type} onChange={(event) => setType(event.target.value as DraftType)}>
            {Object.entries(labels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>

        <div className="draft-two-col">
          <label>
            Meno alebo oslovenie
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="Napr. pán Novák"
            />
          </label>
          <label>
            Lokalita
            <input
              name="locality"
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
              maxLength={120}
              placeholder="Napr. Poprad"
            />
          </label>
        </div>

        <label>
          Len overené fakty
          <textarea
            name="facts"
            value={facts}
            onChange={(event) => setFacts(event.target.value)}
            rows={8}
            minLength={3}
            maxLength={2_000}
            placeholder="Vložte iba fakty, ktoré sú potvrdené v dopyte alebo zákazke."
          />
        </label>
        <p className="admin-muted-note">
          Meno z osobitného poľa sa AI neposiela. Server odstráni rozpoznané formáty e-mailu, telefónu, PSČ,
          odkazu a niektorých presných adries, no automatická redakcia nemôže zachytiť všetko. Do faktov preto
          nevkladajte mená, celé adresy, evidenčné čísla, rodné čísla, heslá, platobné, zdravotné ani iné osobné údaje.
        </p>
        <button
          className="admin-primary-button"
          type="submit"
          disabled={!providerReady || aiPending || facts.trim().length < 3}
        >
          {aiPending ? 'AI pripravuje návrh…' : 'Vylepšiť pomocou AI'}
        </button>
        {aiState.message ? (
          <p className={`work-notice ${aiState.ok ? 'is-success' : 'is-warning'}`} role="status">
            {aiState.message}
          </p>
        ) : null}
      </section>

      <section className="admin-card draft-output" aria-live="polite">
        <header>
          <div>
            <p>{aiState.ok && aiState.requestKey === requestKey ? 'AI pracovný návrh' : 'Lokálna pracovná šablóna'}</p>
            <h2>{labels[type]}</h2>
          </div>
          <button type="button" onClick={copyDraft}>{copied ? 'Skopírované ✓' : 'Kopírovať'}</button>
        </header>
        <pre>{draft}</pre>
        <div className="draft-warning">
          <strong>Pred použitím skontrolujte:</strong>
          <span>správnosť údajov, cenu, termín, adresáta a tón. Tento nástroj nič neodosiela ani neukladá.</span>
        </div>
      </section>
    </form>
  );
}
