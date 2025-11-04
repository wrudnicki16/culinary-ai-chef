import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { vi } from 'vitest'

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })

// Mock session data
export const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  image: 'https://example.com/avatar.jpg',
}

export const mockSession = {
  user: mockUser,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

// All providers wrapper
interface AllProvidersProps {
  children: React.ReactNode
  session?: Session | null
  queryClient?: QueryClient
}

export function AllProviders({
  children,
  session = null,
  queryClient = createTestQueryClient()
}: AllProvidersProps) {
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="ui-theme">
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

// Custom render function
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    session?: Session | null
    queryClient?: QueryClient
  }
) => {
  const { session, queryClient, ...renderOptions } = options || {}

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders session={session} queryClient={queryClient}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  })
}

// Mock fetch for API calls
export const mockFetch = (data: unknown, ok = true, status = 200) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    } as Response)
  )
}

// Mock recipe data
export const mockRecipe = {
  id: 1,
  title: 'Test Recipe',
  description: 'A delicious test recipe',
  imageUrl: 'https://example.com/recipe.jpg',
  ingredients: [
    { name: 'Flour', quantity: '2 cups' },
    { name: 'Sugar', quantity: '1 cup' },
  ],
  instructions: [
    'Mix flour and sugar',
    'Bake for 30 minutes',
  ],
  cookingTime: 30,
  servings: 4,
  dietaryTags: ['vegetarian'],
  nutritionInfo: {
    calories: 200,
    protein: 5,
    fat: 2,
    carbs: 40,
  },
  rating: 4,
  ratingCount: 10,
  isFavorited: false,
  userId: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  isAIGenerated: true,
  isVerified: true,
}

// Mock recipes array
export const mockRecipes = [
  mockRecipe,
  {
    ...mockRecipe,
    id: 2,
    title: 'Another Test Recipe',
    dietaryTags: ['vegan', 'gluten-free'],
  },
]

// Mock admin user
export const mockAdminUser = {
  ...mockUser,
  id: 'admin-user-id',
  name: 'Admin User',
  email: 'admin@example.com',
  roles: ['admin'], // Add roles array for AdminProtected component
}

export const mockAdminSession = {
  user: mockAdminUser,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

// Re-export everything
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export { customRender as render }