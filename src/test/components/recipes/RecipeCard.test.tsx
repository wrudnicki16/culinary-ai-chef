import { render, screen, userEvent } from '@/test/utils'
import { RecipeCard } from '@/components/recipes/recipe-card'
import { mockRecipe } from '@/test/utils'

describe('RecipeCard Component', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render recipe card with all information', () => {
    render(<RecipeCard recipe={mockRecipe} onClick={mockOnClick} />)

    expect(screen.getByText(mockRecipe.title)).toBeInTheDocument()
    expect(screen.getByText(mockRecipe.description)).toBeInTheDocument()
    expect(screen.getByText(`${mockRecipe.cookingTime} min`)).toBeInTheDocument()
    expect(screen.getByText(`${mockRecipe.servings} servings`)).toBeInTheDocument()
    // Rating is displayed through Rating component, not as plain text
    // expect(screen.getByText(`${mockRecipe.rating}`)).toBeInTheDocument()
  })

  it('should display dietary tags', () => {
    render(<RecipeCard recipe={mockRecipe} onClick={mockOnClick} />)

    mockRecipe.dietaryTags.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument()
    })
  })

  it('should show AI generated badge when applicable', () => {
    render(<RecipeCard recipe={mockRecipe} onClick={mockOnClick} />)

    expect(screen.getByText(/AI Generated/i)).toBeInTheDocument()
    expect(screen.getByText(mockRecipe.title)).toBeInTheDocument()
  })

  it('should call onClick when card is clicked', async () => {
    const user = userEvent.setup()
    render(<RecipeCard recipe={mockRecipe} onClick={mockOnClick} />)

    // Find the card element (it's a div, not article)
    const card = screen.getByText(mockRecipe.title).closest('.cursor-pointer')
    await user.click(card!)

    expect(mockOnClick).toHaveBeenCalled()
  })

  it('should handle missing image gracefully', () => {
    const recipeWithoutImage = { ...mockRecipe, imageUrl: null }
    render(<RecipeCard recipe={recipeWithoutImage} onClick={mockOnClick} />)

    // Should still render the card without crashing
    expect(screen.getByText(mockRecipe.title)).toBeInTheDocument()
  })

  it('should display proper rating format', () => {
    const recipeWithRating = {
      ...mockRecipe,
      rating: 4,
      ratingCount: 25,
    }
    render(<RecipeCard recipe={recipeWithRating} onClick={mockOnClick} />)

    // Rating component shows stars and count
    expect(screen.getByText('(25)')).toBeInTheDocument()
    // Check for star rating elements
    expect(document.querySelector('.star-rating')).toBeInTheDocument()
  })

  it('should handle zero ratings', () => {
    const recipeWithNoRatings = {
      ...mockRecipe,
      rating: 0,
      ratingCount: 0,
    }
    render(<RecipeCard recipe={recipeWithNoRatings} onClick={mockOnClick} />)

    // When count is 0, it should still show the rating component
    expect(screen.getByText('(0)')).toBeInTheDocument()
  })

  it('should show verified badge when recipe is verified', () => {
    const verifiedRecipe = { ...mockRecipe, isVerified: true }
    render(<RecipeCard recipe={verifiedRecipe} onClick={mockOnClick} />)

    expect(screen.getByText(/Verified/i)).toBeInTheDocument()
    expect(screen.getByText(mockRecipe.title)).toBeInTheDocument()
  })

  it('should not show badges when not applicable', () => {
    const regularRecipe = { ...mockRecipe, isAIGenerated: false, isVerified: false }
    render(<RecipeCard recipe={regularRecipe} onClick={mockOnClick} />)

    expect(screen.queryByText(/AI Generated/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Verified/i)).not.toBeInTheDocument()
    expect(screen.getByText(mockRecipe.title)).toBeInTheDocument()
  })
})