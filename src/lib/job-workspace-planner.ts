import type { JobWorkspaceOperations } from '../server/job-workspace-types';

export type WorkspacePlanCapacity = { jobId: string; number: string; operations: JobWorkspaceOperations };
export type WorkspaceCapacityWarning = { firstJobId: string; secondJobId: string; firstNumber: string; secondNumber: string; date: string; resource: 'VEHICLE' | 'WORKER'; resourceId: string; certainty: 'OVERLAP' | 'CHECK_TIMES' };

/** Unscheduled job-card plans are conservative warnings, never a routing or load guarantee. */
export function findWorkspaceCapacityWarnings(workspaces: WorkspacePlanCapacity[]): WorkspaceCapacityWarning[] {
  const candidates = workspaces.filter((workspace) => !workspace.operations.plan.actualOn && !['DOKONCENA', 'ZRUSENA', 'DEMONT_DOKONCENA', 'VYUCTOVANIE'].includes(workspace.operations.status));
  const warnings: WorkspaceCapacityWarning[] = [];
  const normalized = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('sk').replace(/[\s-]/g, '');
  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex++) {
    const first = candidates[firstIndex], firstPlan = first.operations.plan;
    const date = firstPlan.agreedOn || firstPlan.tentativeOn;
    if (!date) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex++) {
      const second = candidates[secondIndex], secondPlan = second.operations.plan;
      if (first.jobId === second.jobId || date !== (secondPlan.agreedOn || secondPlan.tentativeOn)) continue;
      const timesKnown = Boolean(firstPlan.timeFrom && firstPlan.timeTo && secondPlan.timeFrom && secondPlan.timeTo);
      if (timesKnown && (firstPlan.timeTo <= secondPlan.timeFrom || secondPlan.timeTo <= firstPlan.timeFrom)) continue;
      for (const resource of ['VEHICLE', 'WORKER'] as const) {
        const firstResources = resource === 'VEHICLE' ? firstPlan.vehicleIds : firstPlan.crewIds;
        const secondResources = new Set((resource === 'VEHICLE' ? secondPlan.vehicleIds : secondPlan.crewIds).map(normalized));
        for (const id of new Map(firstResources.map((id) => [normalized(id), id])).values()) {
          if (!normalized(id) || !secondResources.has(normalized(id))) continue;
          warnings.push({ firstJobId: first.jobId, secondJobId: second.jobId, firstNumber: first.number, secondNumber: second.number, date, resource, resourceId: id, certainty: timesKnown ? 'OVERLAP' : 'CHECK_TIMES' });
        }
      }
    }
  }
  return warnings;
}
