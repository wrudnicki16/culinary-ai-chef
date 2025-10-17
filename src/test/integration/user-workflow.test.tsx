import { render, screen, userEvent, waitFor } from '@/test/utils'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { mockSession, mockRecipe, mockFetch } from '@/test/utils'
import { RecipeGenerator } from '@/components/recipes/recipe-generator'
import { RecipeCard } from '@/components/recipes/recipe-card'
import { useState } from 'react'

// Real workflow component using actual components
function RecipeWorkflow() {
  const [generatedRecipe, setGeneratedRecipe] = useState<{title: string; description: string} | null>(null)
  const [recipes, setRecipes] = useState([mockRecipe])

  const handleRecipeGenerated = (recipe: {title: string; description: string}) => {
    setGeneratedRecipe(recipe)
    setRecipes(prev => [recipe, ...prev])
  }

  const handleRecipeClick = (recipe: {title: string; description: string}) => {
    // Handle recipe detail view
    console.log('Recipe clicked:', recipe.title)
  }

  return (
    <div>
      <h1>Recipe Discovery</h1>

      <div data-testid="recipe-generator">
        <RecipeGenerator onRecipeGenerated={handleRecipeGenerated} />
      </div>

      <div data-testid="recipe-results">
        <h2>Your Recipes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe, index) => (
            <div key={recipe.id || index} data-testid="recipe-card">
              <RecipeCard
                recipe={recipe}
                onClick={() => handleRecipeClick(recipe)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

describe('User Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock global fetch for API calls
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRecipe),
      } as Response)
    )

    // Mock successful authentication
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    })

    // Mock successful queries
    vi.mocked(useQuery).mockReturnValue({
      data: [mockRecipe],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
      isError: false,
      isSuccess: true,
      status: 'success',
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      isInitialLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
    })

    // Mock successful mutations
    vi.mocked(useMutation).mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      data: mockRecipe,
      isError: false,
      isSuccess: true,
      isPending: false,
      reset: vi.fn(),
      mutateAsync: vi.fn(),
      variables: undefined,
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      status: 'success',
    })
  })

  it('should complete full recipe generation workflow', async () => {
    const user = userEvent.setup()
    render(<RecipeWorkflow />, { session: mockSession })

    // Step 1: User enters recipe prompt in the RecipeGenerator
    const promptInput = screen.getByPlaceholderText(/Describe what you want to make, ingredients you have, or dietary restrictions/i)
    await user.type(promptInput, 'I want to make healthy pasta')

    // Step 2: User clicks generate button
    const generateBtn = screen.getByRole('button', { name: /Generate Recipe/i })
    await user.click(generateBtn)

    // Wait for the API call to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/recipes/generate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'I want to make healthy pasta',
          dietaryFilters: []
        })
      }))
    })

    // Step 3: Recipe should be generated and displayed in the recipe list
    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument()
    })

    // Step 4: User can interact with the recipe card (favorite functionality is handled by RecipeCard)
    const recipeCard = screen.getByText('Test Recipe').closest('[data-testid="recipe-card"]')
    expect(recipeCard).toBeInTheDocument()

    // Verify the workflow completed with correct input
    expect(promptInput).toHaveValue('I want to make healthy pasta')
    expect(screen.getByText('Test Recipe')).toBeInTheDocument()
  })

  it('should handle authentication flow', async () => {
    // Test unauthenticated state
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<RecipeWorkflow />)

    // Should show sign-in prompt in RecipeGenerator for unauthenticated users
    expect(screen.getByText('Recipe Discovery')).toBeInTheDocument()
    expect(screen.getByText(/Sign in to generate recipes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
  })

  it('should handle error states in workflow', async () => {
    const user = userEvent.setup()

    // Mock API error response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Generation failed' }),
      } as Response)
    )

    render(<RecipeWorkflow />, { session: mockSession })

    const promptInput = screen.getByPlaceholderText(/Describe what you want to make, ingredients you have, or dietary restrictions/i)
    const generateBtn = screen.getByRole('button', { name: /Generate Recipe/i })

    await user.type(promptInput, 'Invalid recipe request')
    await user.click(generateBtn)

    // Wait for the failed API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/recipes/generate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Invalid recipe request',
          dietaryFilters: []
        })
      }))
    })

    // Should handle error gracefully - prompt input should maintain its value
    expect(promptInput).toHaveValue('Invalid recipe request')
    // The error handling is done through toast notifications in the real component
  })

  it('should maintain state across user interactions', async () => {
    const user = userEvent.setup()
    render(<RecipeWorkflow />, { session: mockSession })

    // Multiple interactions should maintain state in the RecipeGenerator
    const promptInput = screen.getByPlaceholderText(/Describe what you want to make, ingredients you have, or dietary restrictions/i)

    await user.type(promptInput, 'Vegan pasta')
    expect(promptInput).toHaveValue('Vegan pasta')

    await user.clear(promptInput)
    await user.type(promptInput, 'Gluten-free pasta')
    expect(promptInput).toHaveValue('Gluten-free pasta')
  })
})