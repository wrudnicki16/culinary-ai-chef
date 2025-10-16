# Test Suite Documentation

## Overview

This test suite uses **Vitest** + **React Testing Library** to provide comprehensive testing for the Culinary AI Chef application.

## Test Structure

```
src/test/
├── setup.ts                    # Test configuration and global mocks
├── utils.tsx                   # Test utilities and helpers
├── README.md                   # This documentation
├── hooks/                      # Hook testing
│   └── useAuth.test.tsx        # Authentication hook tests
├── components/                 # Component testing
│   ├── auth/
│   │   └── LoginButton.test.tsx
│   ├── recipes/
│   │   ├── RecipeGenerator.test.tsx
│   │   └── RecipeCard.test.tsx
│   └── admin/
│       └── RoleBasedAccess.test.tsx
├── pages/                      # Page component testing
│   └── admin/
│       └── AdminDashboard.test.tsx
├── api/                        # API endpoint testing
│   └── recipes.test.ts
└── integration/                # Integration testing
    └── user-workflow.test.tsx
```

## Test Categories

### 1. Authentication Tests (`/hooks/useAuth.test.tsx`, `/components/auth/`)
- **What it tests**: User authentication state management
- **Key scenarios**:
  - ✅ Unauthenticated user state
  - ✅ Authenticated user state
  - ✅ Loading state during authentication
  - ✅ Admin user role handling
  - ✅ Sign in/out functionality

### 2. Recipe Generation Tests (`/components/recipes/`)
- **What it tests**: AI recipe generation workflow
- **Key scenarios**:
  - ✅ Recipe generation form rendering
  - ✅ Authentication requirements
  - ✅ Form submission with dietary filters
  - ✅ Loading states during generation
  - ✅ Error handling
  - ✅ Form validation

### 3. Recipe Display Tests (`/components/recipes/`)
- **What it tests**: Recipe card display and interactions
- **Key scenarios**:
  - ✅ Recipe information rendering
  - ✅ Dietary tags display
  - ✅ AI-generated badges
  - ✅ Click interactions
  - ✅ Missing image handling
  - ✅ Rating display
  - ✅ Verification badges

### 4. Admin Functionality Tests (`/components/admin/`, `/pages/admin/`)
- **What it tests**: Admin dashboard and role-based access
- **Key scenarios**:
  - ✅ Admin dashboard rendering
  - ✅ Statistics display
  - ✅ Role-based access control
  - ✅ Access denied for non-admin users
  - ✅ Loading and error states
  - ✅ Navigation links

### 5. API Tests (`/api/`)
- **What it tests**: API endpoint functionality
- **Key scenarios**:
  - ✅ Recipe fetching with filters
  - ✅ Recipe generation API
  - ✅ Individual recipe retrieval
  - ✅ Favorite toggle functionality
  - ✅ Error handling
  - ✅ Authentication requirements

### 6. Integration Tests (`/integration/`)
- **What it tests**: Complete user workflows
- **Key scenarios**:
  - ✅ End-to-end recipe generation workflow
  - ✅ Authentication flow integration
  - ✅ Error state handling
  - ✅ State persistence across interactions

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests once (CI mode)
npm run test:run

# Run with UI (visual test runner)
npm run test:ui

# Run with coverage report
npm run test:coverage
```

### Filtering Tests
```bash
# Run specific test file
npm test -- useAuth

# Run tests matching pattern
npm test -- --grep="authentication"

# Run tests in specific directory
npm test -- src/test/components/
```

## Test Utilities

### Custom Render Function
The test suite provides a custom `render` function that automatically wraps components with necessary providers:
- SessionProvider (NextAuth)
- QueryClientProvider (TanStack Query)
- ThemeProvider
- TooltipProvider

### Mock Data
Pre-built mock objects for consistent testing:
- `mockUser` - Standard user data
- `mockAdminUser` - Admin user with roles
- `mockSession` - Authentication session
- `mockRecipe` - Complete recipe object
- `mockRecipes` - Array of recipes

### Helper Functions
- `mockFetch()` - Mock API responses
- `AllProviders` - Provider wrapper component
- `userEvent` - User interaction simulation

## Mocking Strategy

### Global Mocks (setup.ts)
- `next/navigation` - Router mocks
- `next/image` - Image component mock
- `next-auth/react` - Authentication mocks
- `@tanstack/react-query` - Query client mocks

### Test-Specific Mocks
Individual tests can override global mocks for specific scenarios:
```typescript
vi.mocked(useSession).mockReturnValue({
  data: mockAdminSession,
  status: 'authenticated',
})
```

## Best Practices

### 1. Test Structure
- **Arrange**: Set up test data and mocks
- **Act**: Execute the functionality being tested
- **Assert**: Verify expected outcomes

### 2. Test Isolation
- Each test is independent
- Use `beforeEach` to reset mocks
- Clean up after each test automatically

### 3. User-Centric Testing
- Test from user perspective
- Use accessible queries (getByRole, getByLabelText)
- Simulate real user interactions

### 4. Async Testing
- Use `waitFor` for async operations
- Test loading states
- Handle promises properly

## Coverage Goals

- **Components**: 90%+ coverage
- **Hooks**: 95%+ coverage
- **API Logic**: 85%+ coverage
- **Critical Paths**: 100% coverage

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to main branch
- Pre-deployment checks

## Troubleshooting

### Common Issues

1. **Mock not working**: Check global mocks in setup.ts
2. **Provider errors**: Ensure using custom render function
3. **Async issues**: Use waitFor for async operations
4. **Import errors**: Check path aliases in vitest.config.ts

### Debug Tips
- Use `screen.debug()` to see rendered output
- Add `console.log` in tests for debugging
- Use VS Code test runner for better debugging experience