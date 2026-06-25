import { describe, it, expect } from 'vitest';
import { classifyTransition, hasActiveJob, type ClientJob } from '@/lib/generation/transitions';

const base: ClientJob = { jobId: 1, status: 'processing', stage: 'recipe', recipeId: null, error: null, modalDismissed: false };

describe('classifyTransition', () => {
  it('opens the viewer when a non-dismissed job finishes', () => {
    const job = { ...base, status: 'done' as const, recipeId: 7 };
    expect(classifyTransition('processing', job)).toEqual({ kind: 'open-viewer', recipeId: 7 });
  });

  it('toasts success when a dismissed (backgrounded) job finishes', () => {
    const job = { ...base, status: 'done' as const, recipeId: 7, modalDismissed: true };
    expect(classifyTransition('processing', job)).toEqual({ kind: 'toast-success', recipeId: 7 });
  });

  it('toasts an error with the message on failure', () => {
    const job = { ...base, status: 'error' as const, error: 'boom' };
    expect(classifyTransition('processing', job)).toEqual({ kind: 'toast-error', message: 'boom' });
  });

  it('does nothing when the status is unchanged', () => {
    expect(classifyTransition('processing', base)).toEqual({ kind: 'none' });
  });
});

describe('hasActiveJob', () => {
  it('is true only for pending/processing jobs', () => {
    expect(hasActiveJob(base)).toBe(true);
    expect(hasActiveJob({ ...base, status: 'done' })).toBe(false);
    expect(hasActiveJob(null)).toBe(false);
  });
});
