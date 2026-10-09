import { csrfTokenForEmail, requireSuperAdmin } from '@/src/server/auth';
import { listSiteContent } from '@/src/server/db';
import { homeContentDefaults, homepageEditableKeys } from '@/src/server/site-content';
import { mergeSiteContent } from '@/src/server/site-content-map';
import { astanaWebsites } from '@/src/content/site';
import { updateSiteContentAction } from './actions';

const labels: Record<string, string> = {
  heroEyebrow: 'Hero: horný text',
  heroTitle: 'Hero: hlavný nadpis',
  heroClaim: 'Hero: krátky claim',
  heroText: 'Hero: predajný text',
  quoteKicker: 'Formulár: horný text',
  quoteTitle: 'Formulár: nadpis',
  quoteIntro: 'Formulár: krátky text',
  quoteHandled: 'Formulár: zvýraznená veta',
  quotePriorityTitle: 'Formulár: m2 zvýraznenie',
  quotePriorityText: 'Formulár: text pri m2',
  formSubmitText: 'Formulár: text odosielacieho tlačidla',
  ctaPrimary: 'CTA: hlavné tlačidlo',
  ctaPhone: 'CTA: telefónne tlačidlo',
  includedEyebrow: 'Čo je v cene: horný text',
  includedTitle: 'Čo je v cene: nadpis',
  includedText: 'Čo je v cene: úvodný text',
  processEyebrow: 'Proces: horný text',
  processTitle: 'Proces: nadpis',
  riskEyebrow: 'Riziká: horný text',
  riskTitle: 'Riziká: nadpis',
  riskText: 'Riziká: úvodný text',
  riskNoticeTitle: 'Riziká: zvýraznený box nadpis',
  riskNoticeText: 'Riziká: zvýraznený box text',
  cautionEyebrow: 'Na čo si dať pozor: horný text',
  cautionTitle: 'Na čo si dať pozor: nadpis',
  cautionText: 'Na čo si dať pozor: úvodný text',
  roofersEyebrow: 'Strechári: horný text',
  roofersTitle: 'Strechári: nadpis',
  roofersText: 'Strechári: úvodný text',
  roofersCtaPrimary: 'Strechári: tlačidlo zoznam partnerov',
  roofersCtaSecondary: 'Strechári: tlačidlo dopyt',
  whyEyebrow: 'Prečo ASTANA: horný text',
  whyTitle: 'Prečo ASTANA: nadpis',
  realizationsEyebrow: 'Realizácie: horný text',
  realizationsTitle: 'Realizácie: nadpis',
  realizationsText: 'Realizácie: vysvetlenie',
  testimonialsEyebrow: 'Referencie: horný text',
  testimonialsTitle: 'Referencie: nadpis',
  testimonialsText: 'Referencie: vysvetlenie',
  testimonialFormTitle: 'Formulár referencie: nadpis',
  testimonialFormText: 'Formulár referencie: text',
  practiceEyebrow: 'Prax namiesto referencií: horný text',
  practiceTitle: 'Prax namiesto referencií: nadpis',
  practiceText: 'Prax namiesto referencií: vysvetlenie',
  faqEyebrow: 'FAQ: horný text',
  faqTitle: 'FAQ: nadpis',
  faqText: 'FAQ: vysvetlenie',
  finalEyebrow: 'Finálne CTA: horný text',
  finalTitle: 'Finálne CTA: nadpis',
  finalText: 'Finálne CTA: text',
  finalCtaPrimary: 'Finálne CTA: hlavné tlačidlo',
  footerText: 'Footer: krátky text',
  trustItems: 'Trust bar: položky vo formáte Nadpis|Text, každá na nový riadok',
  includedItems: 'Čo je v cene: položky, každá na nový riadok',
  processSteps: 'Proces: kroky vo formáte Nadpis|Text, každý na nový riadok',
  riskItems: 'Riziká: karty vo formáte Nadpis|Text, každá na nový riadok',
  cautionItems: 'Na čo si dať pozor: karty vo formáte Nadpis|Text, každá na nový riadok',
  rooferItems: 'Strechári: karty vo formáte Nadpis|Text, každá na nový riadok',
  practiceItems: 'Prax namiesto referencií: položky vo formáte Nadpis|Text, každá na nový riadok',
  whySafeText: 'Prečo ASTANA: Bezpečný postup',
  whyDocumentationText: 'Prečo ASTANA: Dokumentácia',
  whyRemovalText: 'Prečo ASTANA: Demontáž a odvoz',
  whyExperienceText: 'Prečo ASTANA: Skúsenosti',
  whyPricingText: 'Prečo ASTANA: Nacenenie',
  whyCoverageText: 'Prečo ASTANA: Pôsobnosť',
  whyItems: 'Archív: staré texty kariet Prečo ASTANA (nezverejňujú sa)',
  faqItems: 'FAQ: otázky vo formáte Otázka|Odpoveď, každá na nový riadok',
};

export default async function SiteContentPage({ searchParams }: { searchParams?: Promise<{ stav?: string }> }) {
  const { email: adminEmail } = await requireSuperAdmin();
  const stored = await listSiteContent();
  const content = mergeSiteContent(homeContentDefaults, stored);
  const params = await searchParams;
  const statusMessage = params?.stav === 'ulozene'
    ? 'Texty boli uložené.'
    : params?.stav === 'neplatne'
      ? 'Texty sa neuložili. Niektoré pole nebolo povolené alebo bolo príliš dlhé.'
      : '';

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Verejný web</p>
          <h1>Texty úvodnej stránky</h1>
        </div>
        <a className="admin-secondary-link" href="/" target="_blank" rel="noreferrer">Otvoriť náhľad webu</a>
      </div>

      <section className="admin-card">
        <h2>Editovateľné texty</h2>
        <p>Úpravy sa po uložení premietnu na verejnej stránke. SEO a štruktúra zostávajú zachované.</p>
        {statusMessage ? <div className="admin-alert" role="status">{statusMessage}</div> : null}
        <form className="admin-quote-form" action={updateSiteContentAction}>
          <input type="hidden" name="_csrf" value={csrfTokenForEmail(adminEmail)} />
          {homepageEditableKeys.map((key) => {
            const value = content[key];
            return (
            <label key={key} className={value.length > 90 ? 'admin-form-wide' : ''}>
              {labels[key] || key}
              {value.length > 90 ? (
                <textarea name={`content:${key}`} rows={4} defaultValue={value} maxLength={key.endsWith('Items') ? 10_000 : 3_000} />
              ) : (
                <input name={`content:${key}`} defaultValue={value} maxLength={3_000} />
              )}
            </label>
          );
          })}
          <button className="admin-primary-button" type="submit">
            Uložiť texty
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>GEO, dôkazy a verejné údaje</h2>
        <p>
          AI a vyhľadávače dostávajú rovnaké pravdivé údaje ako návštevník. Skrytý marketingový text sa nepoužíva;
          verejná stránka, JSON-LD, company.json a llms.txt musia hovoriť to isté.
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Oficiálny web</th><th>Úloha</th></tr></thead>
            <tbody>{astanaWebsites.map((website) => <tr key={website.url}>
              <td><a href={website.url} target="_blank" rel="noreferrer">{website.name}</a></td>
              <td>{website.role}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="admin-inline-actions">
          <a className="admin-secondary-link" href="/o-firme/#oficialne-weby" target="_blank" rel="noreferrer">Verejná identita firmy</a>
          <a className="admin-secondary-link" href="/data/company.json" target="_blank" rel="noreferrer">Strojové firemné údaje</a>
          <a className="admin-secondary-link" href="/llms.txt" target="_blank" rel="noreferrer">Informácie pre AI</a>
          <a className="admin-secondary-link" href="/admin/realizacie/pripady">Spravovať overené realizácie</a>
        </p>
      </section>
    </main>
  );
}
