import type { AzbestReference } from '@/src/data/azbestReferences';

type ResponsiveImageProps = {
  image: AzbestReference;
  className?: string;
  imgClassName?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
  sizes?: string;
};

const optimizedImageUrl = (src: string, width: number) =>
  `/_next/image/?url=${encodeURIComponent(src)}&w=${width}&q=75`;

const srcSetFor = (src: string, widths: number[]) =>
  widths.map((item) => `${optimizedImageUrl(src, item)} ${item}w`).join(', ');

const widthsFor = (displayWidth: number) => {
  if (displayWidth <= 520) return [384, 640, 828];
  if (displayWidth <= 900) return [384, 640, 828, 1080];
  return [640, 828, 1080, 1200, 1920];
};

export function ResponsiveImage({
  image,
  className,
  imgClassName,
  loading = 'lazy',
  fetchPriority = 'auto',
  width = 1280,
  height = 860,
  sizes = '(max-width: 760px) 100vw, 50vw',
}: ResponsiveImageProps) {
  const responsiveWidths = widthsFor(width);
  const fallbackWidth = responsiveWidths.includes(1080) ? 1080 : responsiveWidths[responsiveWidths.length - 1];

  return (
    <picture className={className}>
      <source srcSet={srcSetFor(image.webp, responsiveWidths)} sizes={sizes} type="image/webp" />
      <img
        className={imgClassName}
        src={optimizedImageUrl(image.jpg, fallbackWidth)}
        srcSet={srcSetFor(image.jpg, responsiveWidths)}
        sizes={sizes}
        alt={image.alt}
        title={image.title}
        loading={loading}
        decoding={loading === 'eager' ? 'sync' : 'async'}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
      />
    </picture>
  );
}
