import { isActiveStatus, type GenerationStatus } from './stages';

export interface StaleCandidate {
  id: number;
  status: GenerationStatus;
  updatedAt: Date | string | number;
}

export function selectStaleJobIds(jobs: StaleCandidate[], nowMs: number, ttlMs: number): number[] {
  return jobs
    .filter((j) => isActiveStatus(j.status))
    .filter((j) => nowMs - new Date(j.updatedAt).getTime() >= ttlMs)
    .map((j) => j.id);
}
