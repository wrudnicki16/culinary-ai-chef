import { render, screen } from '@/test/utils'
import { useSession } from 'next-auth/react'
import { mockSession, mockAdminSession } from '@/test/utils'
import { AdminProtected } from '@/components/auth/AdminProtected'

// Simple Role-based component for testing
function RoleBasedContent({ requiredRole }: { requiredRole: string }) {
  return (
    <div>
      <h1>Admin Content</h1>
      <p>This content requires {requiredRole} role</p>
      <button>Delete Recipe</button>
      <button>Manage Users</button>
    </div>
  )
}

describe('Role-Based Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock authenticated admin session by default
    vi.mocked(useSession).mockReturnValue({
      data: mockAdminSession,
      status: 'authenticated',
    })
  })

  it('should show admin content for admin users', () => {
    render(
      <AdminProtected>
        <RoleBasedContent requiredRole="admin" />
      </AdminProtected>
    )

    expect(screen.getByText(/admin content/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete recipe/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /manage users/i })).toBeInTheDocument()
  })

  it('should show access denied for regular users', () => {
    // Mock regular user session
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    })

    render(
      <AdminProtected>
        <RoleBasedContent requiredRole="admin" />
      </AdminProtected>
    )

    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    expect(screen.getByText(/admin privileges required/i)).toBeInTheDocument()
  })

  it('should show access denied for unauthenticated users', () => {
    // Mock unauthenticated session
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(
      <AdminProtected>
        <RoleBasedContent requiredRole="admin" />
      </AdminProtected>
    )

    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should show loading state during authentication check', () => {
    // Mock loading session
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'loading',
    })

    render(
      <AdminProtected>
        <RoleBasedContent requiredRole="admin" />
      </AdminProtected>
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should support custom role requirements', () => {
    // Create a user with 'moderator' role
    const moderatorSession = {
      user: { ...mockSession.user, role: 'moderator' },
      expires: mockSession.expires,
    }

    vi.mocked(useSession).mockReturnValue({
      data: moderatorSession,
      status: 'authenticated',
    })

    render(
      <AdminProtected requireRole="moderator">
        <div>Moderator Content</div>
      </AdminProtected>
    )

    expect(screen.getByText(/moderator content/i)).toBeInTheDocument()
  })

  it('should support custom fallback components', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    const customFallback = <div>Custom Access Denied Message</div>

    render(
      <AdminProtected fallback={customFallback}>
        <RoleBasedContent requiredRole="admin" />
      </AdminProtected>
    )

    expect(screen.getByText(/custom access denied message/i)).toBeInTheDocument()
  })
})