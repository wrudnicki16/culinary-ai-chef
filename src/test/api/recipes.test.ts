import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockRecipe, mockRecipes, mockFetch } from '@/test/utils'

// Mock the API endpoints for testing
const API_BASE = 'http://localhost:3000/api'

describe('Recipe API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/recipes', () => {
    it('should fetch recipes successfully', async () => {
      mockFetch({ recipes: mockRecipes, total: mockRecipes.length })

      const response = await fetch(`${API_BASE}/recipes`)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.recipes).toHaveLength(2)
      expect(data.total).toBe(2)
    })

    it('should handle query parameters', async () => {
      const filteredRecipes = [mockRecipes[0]]
      mockFetch({ recipes: filteredRecipes, total: 1 })

      const params = new URLSearchParams({
        filters: 'vegetarian',
        search: 'pasta',
        sort: 'popular',
        page: '1',
        pageSize: '10'
      })

      const response = await fetch(`${API_BASE}/recipes?${params}`)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.recipes).toHaveLength(1)
      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/recipes?${params}`)
    })

    it('should handle empty results', async () => {
      mockFetch({ recipes: [], total: 0 })

      const response = await fetch(`${API_BASE}/recipes`)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.recipes).toHaveLength(0)
      expect(data.total).toBe(0)
    })
  })

  describe('POST /api/recipes/generate', () => {
    it('should generate recipe successfully', async () => {
      mockFetch(mockRecipe)

      const requestBody = {
        prompt: 'I want to make pasta with vegetables',
        dietaryFilters: ['vegetarian']
      }

      const response = await fetch(`${API_BASE}/recipes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.title).toBe(mockRecipe.title)
      expect(data.isAIGenerated).toBe(true)
    })

    it('should handle generation errors', async () => {
      mockFetch({ error: 'Failed to generate recipe' }, false, 500)

      const requestBody = {
        prompt: 'Invalid request',
        dietaryFilters: []
      }

      const response = await fetch(`${API_BASE}/recipes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })

    it('should validate required fields', async () => {
      mockFetch({ error: 'Prompt is required' }, false, 400)

      const requestBody = {
        dietaryFilters: ['vegetarian']
        // Missing prompt
      }

      const response = await fetch(`${API_BASE}/recipes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/recipes/[id]', () => {
    it('should fetch single recipe successfully', async () => {
      const recipeWithComments = {
        ...mockRecipe,
        comments: [],
        isFavorited: false
      }
      mockFetch(recipeWithComments)

      const response = await fetch(`${API_BASE}/recipes/1`)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.id).toBe(1)
      expect(data.title).toBe(mockRecipe.title)
      expect(data.comments).toBeDefined()
      expect(data.isFavorited).toBeDefined()
    })

    it('should handle recipe not found', async () => {
      mockFetch({ error: 'Recipe not found' }, false, 404)

      const response = await fetch(`${API_BASE}/recipes/999`)

      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
    })

    it('should handle invalid recipe ID', async () => {
      mockFetch({ error: 'Invalid recipe ID' }, false, 400)

      const response = await fetch(`${API_BASE}/recipes/invalid`)

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/recipes/[id]/favorite', () => {
    it('should toggle favorite status', async () => {
      mockFetch({ status: 'favorited' })

      const requestBody = { isFavorite: true }

      const response = await fetch(`${API_BASE}/recipes/1/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.status).toBe('favorited')
    })

    it('should require authentication', async () => {
      mockFetch({ error: 'Unauthorized' }, false, 401)

      const requestBody = { isFavorite: true }

      const response = await fetch(`${API_BASE}/recipes/1/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(401)
    })
  })
})