import { isActiveStatus, type GenerationStatus } from './stages';

// A generation job silent longer than this is treated as timed-out. Kept comfortably
// above the generate route's maxDuration (60s), so a healthy in-flight job is never reaped.
export const STALE_GENERATION_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
