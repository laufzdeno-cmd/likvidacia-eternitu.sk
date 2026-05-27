import { site } from '@/src/content/site';
import type { FaqItem } from '@/src/content/seo-content';

const SITE_URL = site.website;

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function absoluteUrl(path: string) {
  if (path.startsWith('http')) return path;
  return `${SITE_URL}${path === '/' ? '/' : path}`;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildFaqJsonLd(faqs: FaqItem[]) {
  return {
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
}

export function buildServiceJsonLd(name: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${absoluteUrl(path)}#service`,
    name,
    description,
    serviceType: 'Likvidácia azbestu a eternitu',
    provider: { '@id': `${SITE_URL}/#organization` },
    areaServed: { '@type': 'Country', name: 'Slovensko' },
    url: absoluteUrl(path),
  };
}

export function buildOrganizationJsonLd() {
  const address = {
    '@type': 'PostalAddress',
    streetAddress: site.address.street,
    postalCode: site.address.postalCode,
    addressLocality: site.address.locality,
    addressCountry: site.address.country,
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: site.brandName,
        legalName: site.legalName,
        url: SITE_URL,
        telephone: site.phoneHref,
        email: site.email,
        logo: `${SITE_URL}/assets/astana-logo.png`,
        address,
        taxID: site.ico,
        vatID: site.icDph,
        sameAs: site.sameAs,
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${SITE_URL}/#business`,
        name: `${site.brandName} - likvidácia azbestu a eternitu`,
        legalName: site.legalName,
        url: SITE_URL,
        telephone: site.phoneHref,
        email: site.email,
        address,
        taxID: site.ico,
        vatID: site.icDph,
        areaServed: { '@type': 'Country', name: site.areaServed },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '07:00',
            closes: '18:00',
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Likvidácia azbestu a eternitu ASTANA',
        url: SITE_URL,
        inLanguage: 'sk-SK',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function BreadcrumbJsonLd({ name, path }: { name: string; path: string }) {
  const jsonLd = buildBreadcrumbJsonLd([
    { name: 'Úvod', path: '/' },
    { name, path },
  ]);

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
