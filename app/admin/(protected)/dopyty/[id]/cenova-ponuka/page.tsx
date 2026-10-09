import { redirect } from 'next/navigation';

export default async function CreateQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/ponuky/nova?lead=${encodeURIComponent(id)}`);
}
