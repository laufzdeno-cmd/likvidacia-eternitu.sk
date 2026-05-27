import { locationPages } from '@/src/content/seo-content';
import { buildPageMetadata, LocationPage } from '../seo-components';

const location = locationPages.find((item) => item.slug === 'trnava')!;

export const metadata = buildPageMetadata({ title: location.title, description: location.description, path: '/likvidacia-azbestu-trnava/' });

export default function Page() {
  return <LocationPage location={location} />;
}
