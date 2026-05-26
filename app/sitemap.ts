import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://likvidacia-eternitu.sk';
  const lastModified = new Date();

  return [
    { url: baseUrl, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/realizacie/`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/strechari/`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/postup/`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/cena-likvidacie-azbestu/`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/faq/`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/recenzie/`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/ochrana-osobnych-udajov/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/cookies/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
