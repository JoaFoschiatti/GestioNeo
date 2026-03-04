import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminLayout from '../components/layouts/AdminLayout'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  authState: { usuario: null, logout: null }
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mocks.authState
}))

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra solo items permitidos para MOZO', () => {
    mocks.authState = { usuario: { rol: 'MOZO', nombre: 'Juan' }, logout: mocks.logout }

    render(
      <AdminLayout />,
      { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> }
    )

    expect(screen.getAllByText('Mesas').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pedidos').length).toBeGreaterThan(0)
    expect(screen.queryByText('Empleados')).toBeNull()
  })

  it('llama logout y navega al cerrar sesion', async () => {
    mocks.authState = { usuario: { rol: 'ADMIN', nombre: 'Admin' }, logout: mocks.logout }

    render(
      <AdminLayout />,
      { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> }
    )

    await userEvent.click(screen.getAllByText('Cerrar sesión')[0])

    expect(mocks.logout).toHaveBeenCalled()
    expect(mocks.navigate).toHaveBeenCalledWith('/login')
  })
})
