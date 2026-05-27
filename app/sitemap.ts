import type { MetadataRoute } from 'next';
import { articles, locationPages } from '@/src/content/seo-content';
import { site } from '@/src/content/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'monthly') => ({
    url: `${site.website}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });

  return [
    page('/', 1, 'weekly'),
    page('/likvidacia-azbestu/', 0.95),
    page('/likvidacia-eternitu/', 0.95),
    page('/cena-likvidacie-azbestu/', 0.9),
    page('/postup/', 0.85),
    page('/faq/', 0.8),
    page('/realizacie/', 0.8),
    page('/recenzie/', 0.55),
    page('/o-firme/', 0.75),
    page('/kontakt/', 0.85),
    page('/poradna/', 0.75),
    page('/strechari/', 0.55),
    page('/pre-strecharov/', 0.45),
    page('/spolupracujuci-strechari/', 0.45),
    ...locationPages.map((location) => page(`/likvidacia-azbestu-${location.slug}/`, 0.72)),
    ...articles.map((article) => page(`/poradna/${article.slug}/`, 0.65)),
    page('/ochrana-osobnych-udajov/', 0.3, 'yearly'),
    page('/cookies/', 0.3, 'yearly'),
    page('/podmienky-pouzivania/', 0.25, 'yearly'),
  ];
}
