import { JOB_WORKSPACE_RELEASE_ENABLED } from './job-workspace-release-mode';

export const jobWorkspaceUnavailableMessage = 'Pracovné karty a importy sú dočasne vypnuté. Pôvodná evidencia zákaziek a ponúk zostáva dostupná.';

export function resolveJobWorkspaceEnabled(releaseEnabled: boolean, environmentValue: string | undefined): boolean {
  return releaseEnabled && environmentValue?.trim().toLowerCase() !== 'false';
}

/** Server only: runtime false can disable an active release; true cannot enable the compiled fallback. */
export function jobWorkspaceEnabled(): boolean {
  return resolveJobWorkspaceEnabled(JOB_WORKSPACE_RELEASE_ENABLED, process.env.ASTANA_JOB_WORKSPACE_ENABLED);
}

export function assertJobWorkspaceEnabled(): void {
  if (!jobWorkspaceEnabled()) throw new Error(jobWorkspaceUnavailableMessage);
}
