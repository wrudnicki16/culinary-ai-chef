import { describe, it, expect } from 'vitest';
import {
  GENERATION_STAGES, DISPLAY_STAGES, stageLabel, stageIndex,
  isTerminalStatus, isActiveStatus,
} from '@/lib/generation/stages';

describe('generation stages', () => {
  it('orders stages queued → finalizing', () => {
    expect(GENERATION_STAGES).toEqual(['queued', 'recipe', 'image', 'nutrition', 'finalizing']);
    expect(stageIndex('recipe')).toBeLessThan(stageIndex('finalizing'));
  });

  it('exposes the 4 visible checklist stages (no queued)', () => {
    expect(DISPLAY_STAGES).toEqual(['recipe', 'image', 'nutrition', 'finalizing']);
  });

  it('labels each stage', () => {
    expect(stageLabel('recipe')).toBe('Creating recipe');
    expect(stageLabel('image')).toBe('Generating image');
    expect(stageLabel('nutrition')).toBe('Analyzing nutrition');
    expect(stageLabel('finalizing')).toBe('Finalizing');
  });

  it('classifies terminal and active statuses', () => {
    expect(isTerminalStatus('done')).toBe(true);
    expect(isTerminalStatus('error')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('processing')).toBe(false);
    expect(isActiveStatus('pending')).toBe(true);
    expect(isActiveStatus('processing')).toBe(true);
    expect(isActiveStatus('done')).toBe(false);
  });
});
