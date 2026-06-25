export const GENERATION_STAGES = ['queued', 'recipe', 'image', 'nutrition', 'finalizing'] as const;
export type GenerationStage = (typeof GENERATION_STAGES)[number];

export const GENERATION_STATUSES = ['pending', 'processing', 'done', 'error', 'cancelled'] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

// Visible checklist steps (excludes the internal 'queued' stage)
export const DISPLAY_STAGES = ['recipe', 'image', 'nutrition', 'finalizing'] as const;

const STAGE_LABELS: Record<GenerationStage, string> = {
  queued: 'Queued',
  recipe: 'Creating recipe',
  image: 'Generating image',
  nutrition: 'Analyzing nutrition',
  finalizing: 'Finalizing',
};

export function stageLabel(stage: GenerationStage): string {
  return STAGE_LABELS[stage];
}

export function stageIndex(stage: GenerationStage): number {
  return GENERATION_STAGES.indexOf(stage);
}

export function isTerminalStatus(status: GenerationStatus): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled';
}

export function isActiveStatus(status: GenerationStatus): boolean {
  return status === 'pending' || status === 'processing';
}
