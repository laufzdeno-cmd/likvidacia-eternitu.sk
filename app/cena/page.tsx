import { permanentRedirect } from 'next/navigation';
import { priceRedirectTarget } from '@/src/server/price-redirect';

type PricePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PricePage({ searchParams }: PricePageProps) {
  permanentRedirect(priceRedirectTarget(await searchParams));
}
