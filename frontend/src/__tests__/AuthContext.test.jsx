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

  it('guarda usuario y tenant al hacer login (token en httpOnly cookie)', async () => {
    const mockUser = { id: 1, email: 'test@example.com', rol: 'ADMIN' }
    const mockTenant = { id: 10, slug: 'demo' }
    // Backend ya no retorna token en body - se setea como httpOnly cookie automáticamente
    api.post.mockResolvedValue({
      data: { usuario: mockUser, tenant: mockTenant }
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

    // Token NO se guarda en localStorage (es httpOnly cookie)
    expect(localStorage.setItem).not.toHaveBeenCalledWith('token', expect.anything())
    // Solo se guardan usuario y tenant para acceso rápido
    expect(localStorage.setItem).toHaveBeenCalledWith('usuario', JSON.stringify(mockUser))
    expect(localStorage.setItem).toHaveBeenCalledWith('tenant', JSON.stringify(mockTenant))
    // Authorization header NO se setea (cookies se envían automáticamente)
    expect(api.defaults.headers.common.Authorization).toBeUndefined()
    expect(screen.getByTestId('tenant')).toHaveTextContent('demo')
  })

  it('limpia estado y storage al hacer logout', async () => {
    const mockUser = { id: 1, email: 'test@example.com', rol: 'ADMIN' }
    api.post.mockResolvedValue({
      data: { usuario: mockUser, tenant: null }
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

    // Logout ahora llama al backend para limpiar la cookie
    api.post.mockResolvedValue({ data: {} })

    await userEvent.click(screen.getByText('logout'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('')
    })

    // Debe llamar al endpoint de logout
    expect(api.post).toHaveBeenCalledWith('/auth/logout')
    // Token NO se guardaba en localStorage (httpOnly cookie)
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('token')
    // Solo se limpian usuario y tenant
    expect(localStorage.removeItem).toHaveBeenCalledWith('usuario')
    expect(localStorage.removeItem).toHaveBeenCalledWith('tenant')
  })
})
