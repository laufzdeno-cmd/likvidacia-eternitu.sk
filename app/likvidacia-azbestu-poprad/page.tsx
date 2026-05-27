import { locationPages } from '@/src/content/seo-content';
import { buildPageMetadata, LocationPage } from '../seo-components';

const location = locationPages.find((item) => item.slug === 'poprad')!;

export const metadata = buildPageMetadata({ title: location.title, description: location.description, path: '/likvidacia-azbestu-poprad/' });

export default function Page() {
  return <LocationPage location={location} />;
}
