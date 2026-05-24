import { listSiteContent } from '@/src/server/db';
import { homeContentDefaults } from '@/src/server/site-content';
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
  quotePriorityTitle: 'Formulár: m² zvýraznenie',
  quotePriorityText: 'Formulár: text pri m²',
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
  whyItems: 'Prečo ASTANA: položky, každá na nový riadok',
  faqItems: 'FAQ: otázky vo formáte Otázka|Odpoveď, každá na nový riadok',
};

export default async function SiteContentPage() {
  const stored = await listSiteContent();
  const storedMap = Object.fromEntries(stored.map((item) => [item.key, item.value]));
  const content = { ...homeContentDefaults, ...storedMap };

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Verejný web</p>
          <h1>Texty úvodnej stránky</h1>
        </div>
      </div>

      <section className="admin-card">
        <h2>Editovateľné texty</h2>
        <p>Úpravy sa po uložení premietnu na verejnej stránke. SEO a štruktúra zostávajú zachované.</p>
        <form className="admin-quote-form" action={updateSiteContentAction}>
          {Object.entries(content).filter(([key]) => key !== 'homepageContentVersion').map(([key, value]) => (
            <label key={key} className={value.length > 90 ? 'admin-form-wide' : ''}>
              {labels[key] || key}
              {value.length > 90 ? (
                <textarea name={`content:${key}`} rows={4} defaultValue={value} />
              ) : (
                <input name={`content:${key}`} defaultValue={value} />
              )}
            </label>
          ))}
          <button className="admin-primary-button" type="submit">
            Uložiť texty
          </button>
        </form>
      </section>
    </main>
  );
}
