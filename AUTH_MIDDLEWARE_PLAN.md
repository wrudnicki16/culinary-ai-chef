# Authentication Middleware Implementation Plan

## Overview
Implement secure authentication middleware for the admin dashboard using Next.js middleware and NextAuth.js integration to ensure only authenticated admin users can access admin functionality.

## Phase 1: Core Protection Setup

### 1. Create Next.js Middleware
**File:** `src/middleware.ts`
- Implement NextAuth.js middleware integration
- Add route protection for `/admin/*` paths
- Configure authorized callback to check admin roles
- Block unauthorized requests at the edge level

```typescript
// Example structure
import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Custom logic here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith('/admin')) {
          return token?.role === 'admin'
        }
        return !!token
      },
    },
  }
)
```

### 2. Database Schema Update
- Add `role` column to users table with default value 'user'
- Create database index on role column for performance
- Create migration script for existing users
- Seed initial admin user

### 3. Extend NextAuth Session
**File:** `src/app/api/auth/[...nextauth]/route.ts`
- Update JWT callback to include user role from database
- Extend session callback to expose role in client sessions
- Add type definitions for extended session object

### 4. Create AdminProtected Component
**File:** `src/components/auth/AdminProtected.tsx`
- React component wrapper for admin-only content
- Handle loading states during authentication
- Show appropriate fallbacks for unauthorized users
- Integrate with useSession hook

## Phase 2: Admin Page Integration

### 1. Update Admin Dashboard
**File:** `src/app/admin/page.tsx`
- Wrap admin dashboard with AdminProtected component
- Ensure proper error boundaries
- Add loading states for better UX

### 2. Create Access Denied Page
**File:** `src/components/auth/AccessDenied.tsx`
- User-friendly access denied message
- Options to sign in or contact admin
- Consistent styling with app theme

### 3. Add Authentication Loading States
- Loading spinner component during auth checks
- Skeleton UI for admin dashboard while loading
- Progressive enhancement approach

### 4. Update Admin Layout
**File:** `src/app/admin/layout.tsx` (if needed)
- Apply AdminProtected wrapper at layout level
- Consistent admin navigation
- Proper error handling

## Phase 3: Testing & Polish

### 1. Fix Existing Admin Tests
- Update test mocks to include role information
- Mock NextAuth.js middleware behavior
- Test AdminProtected component functionality

### 2. Add Middleware Tests
**File:** `src/test/middleware/auth.test.ts`
- Test unauthorized access blocking
- Test admin role verification
- Test redirect behavior

### 3. Test Role-Based Access
- Create test utilities for different user roles
- Test admin vs regular user access patterns
- Integration tests for full auth flow

### 4. Error Handling
- Handle expired sessions gracefully
- Network error fallbacks
- Clear error messages for users

## Technical Implementation Details

### Security Approach
- **Defense in Depth**: Multiple layers (middleware + component)
- **Edge Protection**: Middleware runs before any React code
- **Type Safety**: TypeScript for role validation
- **Framework Integration**: Leverages Next.js best practices

### Performance Considerations
- Middleware runs at edge for fastest blocking
- Minimal database queries for role checking
- Efficient session management
- No unnecessary component renders for blocked users

### Database Changes
```sql
-- Add role column with default value
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- Create index for performance
CREATE INDEX idx_users_role ON users(role);

-- Set admin role for initial admin user
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

### File Structure
```
src/
├── middleware.ts                    # Next.js middleware
├── components/auth/
│   ├── AdminProtected.tsx          # Admin wrapper component
│   ├── AccessDenied.tsx            # Access denied page
│   └── LoadingSpinner.tsx          # Loading component
├── lib/auth/
│   └── roles.ts                    # Role utilities
├── app/api/auth/[...nextauth]/
│   └── route.ts                    # Extended NextAuth config
└── test/middleware/
    └── auth.test.ts                # Middleware tests
```

## Success Criteria
- [ ] Unauthenticated users cannot access `/admin/*` routes
- [ ] Non-admin users see access denied message
- [ ] Admin users can access all admin functionality
- [ ] All existing tests pass with new auth system
- [ ] Proper error handling for edge cases
- [ ] Performance impact is minimal
- [ ] Security audit passes

## Benefits
- **Security**: Multi-layer protection against unauthorized access
- **Performance**: Edge-level blocking with minimal overhead
- **UX**: Clear feedback for different user states
- **Maintainability**: Clean separation of auth logic
- **Scalability**: Easy to extend to other protected routes

## Alternative Approaches Considered
- **API-only protection**: Insufficient for UI security
- **HOC pattern**: More complex than component wrapper
- **Third-party services**: Overkill for current needs
- **Route-level checks**: Requires manual implementation everywhere

The chosen approach provides the best balance of security, performance, and developer experience for this Next.js application.