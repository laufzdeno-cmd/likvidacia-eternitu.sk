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
    <PublicPageShell breadcrumb={breadcrumb}>
      <main className="section simple-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-text">{lead}</p>
        <div className="risk-grid">
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </article>
          ))}
        </div>
        {children}
        <div className="final-actions">
          <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
          <a className="button button-outline" href="/">Späť na úvod</a>
        </div>
      </main>
    </PublicPageShell>
  );
}
