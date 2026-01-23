import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../context/AuthContext'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} } }
  }
}))

function AuthTester() {
  const { usuario, tenant, login, logout } = useAuth()

  return (
    <div>
      <div data-testid="user">{usuario?.email || ''}</div>
      <div data-testid="tenant">{tenant?.slug || ''}</div>
      <button onClick={() => login('test@example.com', 'secret', 'demo')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.getItem.mockReset()
    localStorage.setItem.mockReset()
    localStorage.removeItem.mockReset()
  })

  it('guarda token, usuario y tenant al hacer login', async () => {
    const mockUser = { id: 1, email: 'test@example.com', rol: 'ADMIN' }
    const mockTenant = { id: 10, slug: 'demo' }
    api.post.mockResolvedValue({
      data: { token: 'token-123', usuario: mockUser, tenant: mockTenant }
    })

    render(
      <AuthProvider>
        <AuthTester />
      </AuthProvider>
    )

    await userEvent.click(screen.getByText('login'))

    await waitFor(() => {
      expect(api.defaults.headers.common.Authorization).toBe('Bearer token-123')
    })

    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'token-123')
    expect(localStorage.setItem).toHaveBeenCalledWith('usuario', JSON.stringify(mockUser))
    expect(localStorage.setItem).toHaveBeenCalledWith('tenant', JSON.stringify(mockTenant))
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    expect(screen.getByTestId('tenant')).toHaveTextContent('demo')
  })

  it('limpia estado y storage al hacer logout', async () => {
    const mockUser = { id: 1, email: 'test@example.com', rol: 'ADMIN' }
    api.post.mockResolvedValue({
      data: { token: 'token-123', usuario: mockUser, tenant: null }
    })

    render(
      <AuthProvider>
        <AuthTester />
      </AuthProvider>
    )

    await userEvent.click(screen.getByText('login'))
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    await userEvent.click(screen.getByText('logout'))

    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('usuario')
    expect(localStorage.removeItem).toHaveBeenCalledWith('tenant')
    expect(api.defaults.headers.common.Authorization).toBeUndefined()
    expect(screen.getByTestId('user')).toHaveTextContent('')
  })
})
