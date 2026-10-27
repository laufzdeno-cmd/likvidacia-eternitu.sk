import type { ReactNode } from 'react';
import { ResponsiveImage } from '@/src/components/responsive-image';
import { getAzbestReference } from '@/src/data/azbestReferences';

export function EditorialPhoto({ id, caption, alt, priority = false }: {
  id: string; caption: string; alt: string; priority?: boolean;
}) {
  const photo = { ...getAzbestReference(id), alt };
  return <figure className="editorial-photo">
    <ResponsiveImage image={photo} width={1200} height={800}
      sizes="(max-width: 760px) calc(100vw - 40px), 48vw"
      loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />
    <figcaption>{caption}</figcaption>
  </figure>;
}

export function EditorialHero({ eyebrow, title, lead, photoId, photoAlt, photoCaption, children }: {
  eyebrow: string; title: string; lead: string; photoId: string; photoAlt: string; photoCaption: string; children?: ReactNode;
}) {
  return <section className="editorial-hero">
    <div className="editorial-hero-copy">
      <p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="editorial-lead">{lead}</p>{children}
    </div>
    <EditorialPhoto id={photoId} alt={photoAlt} caption={photoCaption} priority />
  </section>;
}

export function UsefulChecklist({ title, items }: { title: string; items: readonly string[] }) {
  return <aside className="editorial-checklist"><h2>{title}</h2><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></aside>;
}

export function ReadingLinks({ title = 'Čo vám môže pomôcť ďalej', links }: {
  title?: string; links: ReadonlyArray<{ href: string; title: string; text: string }>;
}) {
  return <section className="seo-section editorial-reading"><h2>{title}</h2><div className="editorial-reading-grid">
    {links.map(link => <a href={link.href} key={link.href}><strong>{link.title}<span aria-hidden="true"> ↗</span></strong><span>{link.text}</span></a>)}
  </div></section>;
}
