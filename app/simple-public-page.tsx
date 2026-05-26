import PublicBaseClient from './public-base-client';
import { PublicFooter, PublicHeader } from './public-layout';
import PublicWidgets from './public-widgets';
import { BreadcrumbJsonLd } from './seo-json-ld';

type SimplePublicPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  sections: Array<{ title: string; text: string }>;
  breadcrumb: { name: string; path: string };
};

export default function SimplePublicPage({ eyebrow, title, lead, sections, breadcrumb }: SimplePublicPageProps) {
  return (
    <>
      <BreadcrumbJsonLd name={breadcrumb.name} path={breadcrumb.path} />
      <PublicHeader />
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
        <div className="final-actions">
          <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
          <a className="button button-outline" href="/">Späť na úvod</a>
        </div>
      </main>
      <PublicFooter />
      <PublicBaseClient />
      <PublicWidgets />
    </>
  );
}
