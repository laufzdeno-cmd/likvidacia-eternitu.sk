export const NEXT_PRODUCTION_BUILD_PHASE = 'phase-production-build';

export function shouldInitializeSiteContentSchema(phase = process.env.NEXT_PHASE) {
  return phase !== NEXT_PRODUCTION_BUILD_PHASE;
}

export function shouldUseDefaultSiteContent(phase: string | undefined, hasDatabase: boolean) {
  return phase === NEXT_PRODUCTION_BUILD_PHASE && !hasDatabase;
}

export function shouldFallbackToDefaultSiteContent(error: unknown, phase = process.env.NEXT_PHASE) {
  return (
    phase === NEXT_PRODUCTION_BUILD_PHASE
    && typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === '42P01'
  );
}
