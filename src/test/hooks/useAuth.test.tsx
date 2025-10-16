import { renderHook } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useAuth } from '@/hooks/useAuth'
import { AllProviders, mockSession, mockUser } from '@/test/utils'

// Mock useSession
vi.mocked(useSession).mockReturnValue({
  data: null,
  status: 'unauthenticated',
})

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return unauthenticated state when no session', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    })

    expect(result.current.user).toBeUndefined()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it('should return authenticated state when session exists', () => {
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('should return loading state during authentication', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'loading',
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    })

    expect(result.current.user).toBeUndefined()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  it('should handle admin user correctly', () => {
    const adminSession = {
      ...mockSession,
      user: {
        ...mockUser,
        roles: ['admin'],
      },
    }

    vi.mocked(useSession).mockReturnValue({
      data: adminSession,
      status: 'authenticated',
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    })

    expect(result.current.user).toEqual(adminSession.user)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })
})