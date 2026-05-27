import { servicePages } from '@/src/content/seo-content';
import { buildPageMetadata, ServicePage } from '../seo-components';

const page = servicePages.eternit;

export const metadata = buildPageMetadata({
  title: page.title,
  description: page.description,
  path: page.slug,
});

export default function EternitPage() {
  return <ServicePage page={page} />;
}
