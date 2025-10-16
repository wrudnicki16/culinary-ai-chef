import { render, screen, userEvent } from '@/test/utils'
import { signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

// Simple Login/Logout button component for testing
function LoginButton({ isAuthenticated }: { isAuthenticated: boolean }) {
  const handleAuth = () => {
    if (isAuthenticated) {
      signOut()
    } else {
      signIn('google')
    }
  }

  return (
    <Button onClick={handleAuth} data-testid="auth-button">
      {isAuthenticated ? 'Sign Out' : 'Sign In with Google'}
    </Button>
  )
}

describe('LoginButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render sign in button when not authenticated', () => {
    render(<LoginButton isAuthenticated={false} />)

    const button = screen.getByTestId('auth-button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Sign In with Google')
  })

  it('should render sign out button when authenticated', () => {
    render(<LoginButton isAuthenticated={true} />)

    const button = screen.getByTestId('auth-button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Sign Out')
  })

  it('should call signIn when clicking sign in button', async () => {
    const user = userEvent.setup()
    render(<LoginButton isAuthenticated={false} />)

    const button = screen.getByTestId('auth-button')
    await user.click(button)

    expect(signIn).toHaveBeenCalledWith('google')
  })

  it('should call signOut when clicking sign out button', async () => {
    const user = userEvent.setup()
    render(<LoginButton isAuthenticated={true} />)

    const button = screen.getByTestId('auth-button')
    await user.click(button)

    expect(signOut).toHaveBeenCalled()
  })
})