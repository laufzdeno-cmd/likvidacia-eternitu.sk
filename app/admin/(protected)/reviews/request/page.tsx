import { redirect } from 'next/navigation';

export default async function LegacyReviewRequestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  if (query.zakazka) params.set('job', query.zakazka);
  if (query.result === 'invalid') params.set('notice', 'invalid_selection');
  if (query.result === 'saved') params.set('notice', 'prepared');
  const suffix = params.toString();
  redirect(suffix ? `/admin/referencie?${suffix}` : '/admin/referencie');
}
