import { isActiveStatus, type GenerationStage, type GenerationStatus } from './stages';

export interface ClientJob {
  jobId: number;
  status: GenerationStatus;
  stage: GenerationStage;
  recipeId: number | null;
  error: string | null;
  modalDismissed: boolean;
}

export type GenerationEffect =
  | { kind: 'open-viewer'; recipeId: number }
  | { kind: 'toast-success'; recipeId: number }
  | { kind: 'toast-error'; message: string }
  | { kind: 'none' };

export function classifyTransition(prevStatus: GenerationStatus, job: ClientJob): GenerationEffect {
  if (prevStatus === job.status) return { kind: 'none' };
  if (job.status === 'done' && job.recipeId != null) {
    return job.modalDismissed
      ? { kind: 'toast-success', recipeId: job.recipeId }
      : { kind: 'open-viewer', recipeId: job.recipeId };
  }
  if (job.status === 'error') {
    return { kind: 'toast-error', message: job.error ?? 'Recipe generation failed' };
  }
  return { kind: 'none' };
}

export function hasActiveJob(job: ClientJob | null): boolean {
  return job != null && isActiveStatus(job.status);
}
