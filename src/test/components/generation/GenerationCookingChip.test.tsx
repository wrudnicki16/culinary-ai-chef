import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { CookingChip } from '@/components/generation/cooking-chip';

const useGenerationMock = vi.fn();
// The shared test wrapper renders <GenerationProvider>, so the mock must export a
// passthrough for it (not just useGeneration), or the wrapper renders `undefined`.
vi.mock('@/components/generation/generation-provider', () => ({
  GenerationProvider: ({ children }: { children: ReactNode }) => children,
  useGeneration: () => useGenerationMock(),
}));

describe('CookingChip', () => {
  it('renders when a job is active', () => {
    useGenerationMock.mockReturnValue({
      job: { jobId: 1, status: 'processing', stage: 'recipe', recipeId: null, error: null, modalDismissed: true },
      isGenerating: true, reopenModal: vi.fn(),
    });
    render(<CookingChip />);
    expect(screen.getByRole('button', { name: /view recipe in progress/i })).toBeInTheDocument();
  });

  it('renders nothing when there is no active job', () => {
    useGenerationMock.mockReturnValue({ job: null, isGenerating: false, reopenModal: vi.fn() });
    const { container } = render(<CookingChip />);
    expect(container).toBeEmptyDOMElement();
  });
});
