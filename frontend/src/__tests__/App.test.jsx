import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'

// Mock del módulo api
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.getItem.mockClear()
    localStorage.setItem.mockClear()
    localStorage.removeItem.mockClear()
  })

  it('should render children', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <div data-testid="child">Test Child</div>
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('should check localStorage on mount', () => {
    localStorage.getItem.mockReturnValue(null)

    render(
      <BrowserRouter>
        <AuthProvider>
          <div>Test</div>
        </AuthProvider>
      </BrowserRouter>
    )

    expect(localStorage.getItem).toHaveBeenCalledWith('token')
    expect(localStorage.getItem).toHaveBeenCalledWith('usuario')
  })

  it('should restore user from localStorage if token exists', () => {
    const mockUser = { id: 1, nombre: 'Test', email: 'test@test.com', rol: 'ADMIN' }
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'token') return 'fake-token'
      if (key === 'usuario') return JSON.stringify(mockUser)
      return null
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <div>Test</div>
        </AuthProvider>
      </BrowserRouter>
    )

    expect(localStorage.getItem).toHaveBeenCalledWith('token')
    expect(localStorage.getItem).toHaveBeenCalledWith('usuario')
  })
})
