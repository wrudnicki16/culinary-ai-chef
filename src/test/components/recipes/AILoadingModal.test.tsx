import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { AILoadingModal } from '@/components/recipes/ai-loading-modal';

vi.mock('@/components/generation/generation-provider', () => ({
  useGeneration: () => ({
    job: { jobId: 1, status: 'processing', stage: 'image', recipeId: null, error: null, modalDismissed: false },
    dismissModal: vi.fn(), cancel: vi.fn(), reopenModal: vi.fn(), start: vi.fn(), isGenerating: true,
  }),
}));

describe('AILoadingModal', () => {
  it('renders the real-stage checklist with the current stage active', () => {
    render(<AILoadingModal />);
    expect(screen.getByText('Creating recipe')).toBeInTheDocument();
    expect(screen.getByText('Generating image')).toBeInTheDocument();
    expect(screen.getByText('Analyzing nutrition')).toBeInTheDocument();
    expect(screen.getByText('Continue browsing')).toBeInTheDocument();
  });
});
