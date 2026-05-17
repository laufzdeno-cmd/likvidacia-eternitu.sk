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
  return (
    <picture className={className}>
      <source srcSet={image.webp} type="image/webp" />
      <img
        className={imgClassName}
        src={image.jpg}
        alt={image.alt}
        title={image.title}
        loading={loading}
        decoding={loading === 'eager' ? 'sync' : 'async'}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        sizes={sizes}
      />
    </picture>
  );
}
