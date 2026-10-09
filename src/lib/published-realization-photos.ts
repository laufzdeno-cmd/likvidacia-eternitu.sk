import type { PublishedRealizationCase } from '../server/types';

type PublishedPhotoSource = Pick<PublishedRealizationCase, 'photos' | 'photoIds'>;

/** Public cards intentionally show at most three approved photos in owner-defined order. */
export function selectPublishedRealizationPhotos(item: PublishedPhotoSource) {
  const photos = item.photos.length
    ? item.photos
    : item.photoIds.map((id, sortOrder) => ({
      id,
      phase: 'during' as const,
      publicCaption: '',
      sortOrder,
    }));

  return [...photos]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 3);
}
