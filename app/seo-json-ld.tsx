import { site } from '@/src/content/site';
import type { FaqItem } from '@/src/content/seo-content';
import { serializeJsonLd } from '@/src/lib/json-ld-serialize.mjs';

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

export function buildFaqJsonLd(faqs: readonly FaqItem[]) {
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

export function buildArticleJsonLd({
  headline,
  description,
  path,
  articleBody,
}: {
  headline: string;
  description: string;
  path: string;
  articleBody: string;
}) {
  const url = absoluteUrl(path);
  const organizationId = `${SITE_URL}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline,
    description,
    articleBody,
    articleSection: 'Poradňa',
    inLanguage: 'sk-SK',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@id': organizationId },
    publisher: { '@id': organizationId },
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
        '@type': ['Organization', 'ProfessionalService'],
        '@id': `${SITE_URL}/#organization`,
        name: site.brandName,
        legalName: site.legalName,
        url: SITE_URL,
        telephone: site.phoneHref,
        email: site.email,
        logo: `${SITE_URL}/assets/astana-logo.png`,
        address,
        foundingDate: site.claimedStats.foundedOrActiveSince.value,
        identifier: {
          '@type': 'PropertyValue',
          propertyID: 'IČO',
          value: site.ico,
        },
        taxID: site.dic,
        vatID: site.icDph,
        sameAs: site.sameAs,
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
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export function BreadcrumbJsonLd({ name, path, parents = [] }: { name: string; path: string; parents?: BreadcrumbItem[] }) {
  const jsonLd = buildBreadcrumbJsonLd([
    { name: 'Úvod', path: '/' },
    ...parents,
    { name, path },
  ]);

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />;
}
