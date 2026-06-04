import { render, screen } from '@/test/utils'
import { useSession } from 'next-auth/react'
import { RecipeCreator } from '@/components/recipes/recipe-creator'
import { mockSession } from '@/test/utils'

describe('RecipeCreator Component', () => {
  const mockOnRecipeGenerated = vi.fn()

  beforeAll(() => {
    // Radix/jsdom stubs
    window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} }
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn()
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    })
  })

  it('renders the Create a recipe card when authenticated', () => {
    render(<RecipeCreator onRecipeGenerated={mockOnRecipeGenerated} />, { session: mockSession })

    expect(screen.getByText('Create a recipe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate recipe \(guided\)/i })).toBeInTheDocument()
  })

  it('renders the sign-in card when unauthenticated', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<RecipeCreator onRecipeGenerated={mockOnRecipeGenerated} />)

    expect(screen.getByText('Create a recipe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})
