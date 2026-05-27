import { notFound } from 'next/navigation';
import { articles } from '@/src/content/seo-content';
import { ArticlePage, buildPageMetadata } from '../../seo-components';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) return {};

  return buildPageMetadata({
    title: `${article.title} | ASTANA`,
    description: article.description,
    path: `/poradna/${article.slug}/`,
  });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);

  if (!article) {
    notFound();
  }

  return <ArticlePage article={article} />;
}
