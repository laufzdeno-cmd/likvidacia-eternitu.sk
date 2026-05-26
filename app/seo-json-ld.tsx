const SITE_URL = 'https://likvidacia-eternitu.sk';

type BreadcrumbItem = {
  name: string;
  path: string;
};

function absoluteUrl(path: string) {
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

export function BreadcrumbJsonLd({ name, path }: { name: string; path: string }) {
  const jsonLd = buildBreadcrumbJsonLd([
    { name: 'Úvod', path: '/' },
    { name, path },
  ]);

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
