import { render, screen } from '@/test/utils'
import { RecipeDetailModal } from '@/components/recipes/recipe-detail-modal'
import type { Recipe } from '@/lib/types'

// jsdom lacks some APIs Radix Dialog/Select rely on
beforeAll(() => {
  // @ts-expect-error - minimal stub
  global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

const recipe: Recipe = {
  id: 1,
  title: 'Test Bowl',
  description: 'A tasty test bowl.',
  imageUrl: null,
  ingredients: [{ name: 'rice', quantity: '2 cups' }],
  instructions: ['Cook rice.'],
  cookingTime: 30,
  servings: 4,
  dietaryTags: ['Gluten Free', 'High Protein'],
  nutritionInfo: { calories: 500, protein: 40, fat: 20, carbs: 60, fiber: 5 },
  rating: 4.5,
  ratingCount: 12,
  userId: 'u1',
  comments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  isAIGenerated: true,
  isVerified: true,
}

describe('RecipeDetailModal servings control', () => {
  it('renders allergen pills, a servings control, and base per-serving macros', () => {
    render(<RecipeDetailModal recipe={recipe} open={true} onClose={() => {}} />)
    expect(screen.getByText('Gluten Free')).toBeInTheDocument()
    expect(screen.getByLabelText('Servings')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument() // base per-serving calories
  })
})
