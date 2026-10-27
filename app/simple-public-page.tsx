import type React from 'react';
import { PublicPageShell } from './public-layout';

type SimplePublicPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  sections: Array<{ title: string; text: string }>;
  breadcrumb: { name: string; path: string };
  children?: React.ReactNode;
};

export default function SimplePublicPage({ eyebrow, title, lead, sections, breadcrumb, children }: SimplePublicPageProps) {
  return (
    <PublicPageShell breadcrumb={breadcrumb} hideWhatsappOnMobile>
      <main className="section simple-page editorial-legal">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="editorial-lead">{lead}</p>
        <nav className="editorial-toc" aria-label="Obsah stránky"><p>Prehľad informácií</p><ul>{sections.map((section, index) => <li key={section.title}><a href={`#informacia-${index + 1}`}>{section.title}</a></li>)}</ul></nav>
        <div className="editorial-legal-body">
          {sections.map((section, index) => (
            <article key={section.title} id={`informacia-${index + 1}`}>
              <h2>{section.title}</h2>
              {section.text.split('\n\n').map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </article>
          ))}
        </div>
        {children}
        <div className="final-actions">
          <a href="/kontakt/">Kontakt na ASTANA</a>
          <a href="/ochrana-osobnych-udajov/">Ochrana osobných údajov</a>
          <a href="/cookies/">Voľba cookies</a>
        </div>
      </main>
    </PublicPageShell>
  );
}
