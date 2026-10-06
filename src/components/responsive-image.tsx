import type { AzbestReference } from '@/src/data/azbestReferences';

type ResponsiveImageProps = {
  image: AzbestReference;
  className?: string;
  imgClassName?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  deferUntilVisible?: boolean;
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
  deferUntilVisible = false,
  width = 1280,
  height = 860,
  sizes = '(max-width: 760px) 100vw, 50vw',
}: ResponsiveImageProps) {
  const responsiveWidths = widthsFor(width);
  const fallbackWidth = responsiveWidths.includes(1080) ? 1080 : responsiveWidths[responsiveWidths.length - 1];
  const webpSrcSet = srcSetFor(image.webp, responsiveWidths);
  const jpgSrc = optimizedImageUrl(image.jpg, fallbackWidth);
  const jpgSrcSet = srcSetFor(image.jpg, responsiveWidths);

  if (deferUntilVisible) {
    return (
      <>
        <picture className={className} data-deferred-responsive-image aria-hidden="true">
          <source data-deferred-srcset={webpSrcSet} data-deferred-sizes={sizes} type="image/webp" />
          <img
            className={imgClassName}
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            data-deferred-src={jpgSrc}
            data-deferred-srcset={jpgSrcSet}
            data-deferred-sizes={sizes}
            data-deferred-alt={image.alt}
            alt=""
            title={image.title}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            width={width}
            height={height}
          />
        </picture>
        <noscript>
          <picture className={className}>
            <source srcSet={webpSrcSet} sizes={sizes} type="image/webp" />
            <img
              className={imgClassName}
              src={jpgSrc}
              srcSet={jpgSrcSet}
              sizes={sizes}
              alt={image.alt}
              title={image.title}
              loading={loading}
              decoding="async"
              fetchPriority={fetchPriority}
              width={width}
              height={height}
            />
          </picture>
        </noscript>
      </>
    );
  }

  return (
    <picture className={className}>
      <source srcSet={webpSrcSet} sizes={sizes} type="image/webp" />
      <img
        className={imgClassName}
        src={jpgSrc}
        srcSet={jpgSrcSet}
        sizes={sizes}
        alt={image.alt}
        title={image.title}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        width={width}
        height={height}
      />
    </picture>
  );
}
