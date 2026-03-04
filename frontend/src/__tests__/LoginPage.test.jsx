import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Login from '../pages/Login'
import toast from 'react-hot-toast'

const mockNavigate = vi.fn()
const mockUseParams = vi.fn()
const mockLogin = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams()
  }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inicia sesion y navega al dashboard', async () => {
    mockUseParams.mockReturnValue({ slug: 'demo' })
    mockLogin.mockResolvedValueOnce({ id: 1 })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(screen.queryByPlaceholderText('mi-restaurante')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('usuario@ejemplo.com'), 'admin@demo.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret')
    await user.click(screen.getByRole('button', { name: /Ingresar/i }))

    expect(mockLogin).toHaveBeenCalledWith('admin@demo.com', 'secret', 'demo', { skipToast: true })
    expect(toast.success).toHaveBeenCalledWith('Bienvenido!')
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('muestra error cuando el login falla', async () => {
    mockUseParams.mockReturnValue({})
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: { message: 'Credenciales invalidas' } } }
    })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText('mi-restaurante'), 'mi-local')
    await user.type(screen.getByPlaceholderText('usuario@ejemplo.com'), 'admin@demo.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret')
    await user.click(screen.getByRole('button', { name: /Ingresar/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Credenciales invalidas')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
