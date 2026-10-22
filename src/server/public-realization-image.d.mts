export function isSafePublicRealizationImageUrl(value: string): boolean;
export function normalizePublicRealizationImageUrl(value: string): string | null;
export type PublicRealizationImageCheckOptions = {
  publicRoot?: string;
  isVercel?: boolean;
  vercelEnv?: string;
  vercelTargetEnv?: string;
  requestHost?: string | null;
  fetchImpl?: typeof fetch;
};
export type PublicRealizationImageCheckResult =
  | { available: true }
  | { available: false; reason: 'verification-unavailable' | 'image-unavailable' };
export function checkPublicRealizationImagesAvailable(imageUrls: string[], options?: PublicRealizationImageCheckOptions): Promise<PublicRealizationImageCheckResult>;
export function arePublicRealizationImagesAvailable(imageUrls: string[], options?: PublicRealizationImageCheckOptions): Promise<boolean>;
