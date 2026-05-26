import type { Metadata } from 'next';
import { PublicPageShell } from '../public-layout';

export const metadata: Metadata = {
  title: 'Časté otázky o likvidácii azbestu | ASTANA',
  description:
    'Odpovede na najčastejšie otázky: Je azbest nebezpečný? Koľko to stojí? Musím mať povolenie? Čo dostanem po skončení prác? Ako dlho to trvá?',
  keywords: 'otázky likvidácia azbestu, azbest nebezpečný, povolenie demontáž eternitu, doklady po likvidácii azbestu',
  alternates: { canonical: '/faq/' },
  openGraph: {
    title: 'Časté otázky o likvidácii azbestu | ASTANA',
    description: 'Praktické odpovede k bezpečnej likvidácii azbestu, dokumentácii, odvozu, cenám a termínom.',
    images: ['/og/faq.jpg'],
  },
};

const faqs = [
  {
    question: 'Je azbest nebezpečný?',
    answer: 'Áno. Azbest je karcinogénny materiál. Pri poškodení môže uvoľňovať mikroskopické vlákna, ktoré sú pri vdýchnutí zdravotným rizikom.',
  },
  {
    question: 'Môžem eternit odstrániť svojpomocne?',
    answer: 'Pri azbeste nejde len o fyzické zloženie krytiny. Treba riešiť bezpečnú manipuláciu, balenie, odvoz na určené miesto a dokumentáciu.',
  },
  {
    question: 'Čo dostanem po skončení prác?',
    answer: 'Po ukončení a úhrade zákazky dostanete potvrdenie a dokumentáciu podľa rozsahu prác, aby bola likvidácia preukázateľná aj pri kontrole.',
  },
  {
    question: 'Čo ak neviem presnú výmeru?',
    answer: 'Stačí približný odhad v m². Fotky pomôžu spresniť prístup, výšku objektu a typ materiálu.',
  },
  {
    question: 'Musím mať strechára pred likvidáciou?',
    answer: 'Nie vždy. Ak strechára nemáte, vieme vám odporučiť spolupracujúceho strechára podľa regiónu.',
  },
  {
    question: 'Čo je penetračný postrek?',
    answer: 'Je to stabilizácia materiálu pred manipuláciou, ktorá pomáha znížiť riziko uvoľňovania prachu počas demontáže.',
  },
  {
    question: 'Ako dlho trvá vybavenie úradov?',
    answer: 'Závisí od konkrétnej zákazky a úradného postupu. Pri plánovaní termínu počítame s potrebným časom na dokumentáciu a rozhodnutia.',
  },
  {
    question: 'Môžem byť doma počas demontáže?',
    answer: 'Podľa situácie sa dohodne bezpečný režim pohybu na pozemku. Pracovný priestor musí zostať kontrolovaný a prístupný pre realizačný tím.',
  },
  {
    question: 'Čo je SLNO?',
    answer: 'SLNO je sprievodný list nebezpečných odpadov. Slúži ako doklad o nakladaní s odpadom a jeho odovzdaní na určené miesto.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Časté otázky', path: '/faq/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">FAQ</p>
          <h1>Najčastejšie otázky o likvidácii azbestu</h1>
          <p>Praktické odpovede k dokumentácii, bezpečnosti, odvozu, cene a nadväznosti na strechárov.</p>
        </section>
        <section className="seo-section seo-faq">
          {faqs.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
        <section className="seo-cta">
          <h2>Nenašli ste odpoveď?</h2>
          <p>Pošlite nám výmeru, lokalitu a otázku. Ozveme sa vám s ďalším postupom.</p>
          <a className="button button-primary" href="/#dopyt">Kontaktovať ASTANA</a>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </PublicPageShell>
  );
}
