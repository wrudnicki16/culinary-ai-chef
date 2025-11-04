import { render, screen } from '@/test/utils'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboard from '@/app/admin/page'
import { mockAdminSession, mockSession, mockFetch } from '@/test/utils'

// Mock the admin stats data
const mockAdminStats = {
  userCount: 150,
  recipeCount: 1250,
  generationCount: 3500,
  activeUsers: 45,
}

describe('Admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch(mockAdminStats)

    // Mock authenticated admin session by default
    vi.mocked(useSession).mockReturnValue({
      data: mockAdminSession,
      status: 'authenticated',
    })

    // Mock useQuery for admin stats
    vi.mocked(useQuery).mockReturnValue({
      data: mockAdminStats,
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
  })

  it('should render admin dashboard for admin user', () => {
    render(<AdminDashboard />, { session: mockAdminSession })

    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/manage recipes, users, and application settings/i)).toBeInTheDocument()
  })

  it('should display admin statistics', () => {
    render(<AdminDashboard />, { session: mockAdminSession })

    expect(screen.getByText('150')).toBeInTheDocument() // userCount
    expect(screen.getByText('1250')).toBeInTheDocument() // recipeCount (no formatting in component)
    expect(screen.getByText('3500')).toBeInTheDocument() // generationCount (no formatting in component)
    expect(screen.getByText('45')).toBeInTheDocument() // activeUsers
  })

  it('should show access denied for non-admin users', () => {
    // Mock regular user session
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    })

    render(<AdminDashboard />)

    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument()
    expect(screen.getByText(/Admin privileges required/i)).toBeInTheDocument()
  })

  it('should show access denied for unauthenticated users', () => {
    // Mock unauthenticated session
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<AdminDashboard />)

    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument()
    expect(screen.getByText(/Admin privileges required/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should display loading state while fetching stats', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
      isError: false,
      isSuccess: false,
      status: 'pending',
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'fetching',
      isInitialLoading: true,
      isLoadingError: false,
      isPaused: false,
      isPending: true,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
    })

    render(<AdminDashboard />, { session: mockAdminSession })

    // Should show admin dashboard header
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument()

    // Should show loading placeholders instead of actual stats
    expect(screen.queryByText('150')).not.toBeInTheDocument()
    expect(screen.queryByText('1250')).not.toBeInTheDocument()
  })

  it('should show loading state during authentication check', () => {
    // Mock loading authentication state
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'loading',
    })

    render(<AdminDashboard />)

    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  it('should handle stats fetch error', () => {
    const mockRefetch = vi.fn()
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch stats'),
      refetch: mockRefetch,
      isFetching: false,
      isError: true,
      isSuccess: false,
      status: 'error',
      dataUpdatedAt: 0,
      errorUpdatedAt: Date.now(),
      failureCount: 1,
      failureReason: new Error('Failed to fetch stats'),
      fetchStatus: 'idle',
      isInitialLoading: false,
      isLoadingError: true,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
    })

    render(<AdminDashboard />, { session: mockAdminSession })

    // Should show error message and retry button
    expect(screen.getByText(/Error loading statistics/i)).toBeInTheDocument()
    expect(screen.getByText(/There was a problem loading the admin statistics/i)).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()

    // Should call refetch when retry button is clicked
    retryButton.click()
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('should have navigation links to admin sections', () => {
    render(<AdminDashboard />, { session: mockAdminSession })

    expect(screen.getByRole('link', { name: /manage recipes/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /manage users/i })).toBeInTheDocument()
  })

  it('should display recent activity section', () => {
    render(<AdminDashboard />, { session: mockAdminSession })

    expect(screen.getByText(/recent activity/i)).toBeInTheDocument()
  })
})