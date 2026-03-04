import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

let authState = { usuario: null, loading: false }

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState
}))

vi.mock('../components/layouts/AdminLayout', async () => {
  const { Outlet } = await vi.importActual('react-router-dom')
  return {
    default: () => (
      <div data-testid="admin-layout">
        <Outlet />
      </div>
    )
  }
})

vi.mock('../components/layouts/PublicLayout', () => ({
  default: ({ children }) => <div data-testid="public-layout">{children}</div>
}))

vi.mock('../components/RedirectByRole', () => ({
  default: () => <div data-testid="redirect-by-role" />
}))

vi.mock('../pages/Login', () => ({
  default: () => <div>LoginPage</div>
}))
vi.mock('../pages/MenuPublico', async () => {
  const { useParams } = await vi.importActual('react-router-dom')
  return {
    default: () => {
      const { slug } = useParams()
      return <div>MenuPublico:{slug}</div>
    }
  }
})
vi.mock('../pages/Registro', () => ({ default: () => <div>Registro</div> }))
vi.mock('../pages/VerificarEmail', () => ({ default: () => <div>VerificarEmail</div> }))
vi.mock('../pages/admin/Dashboard', () => ({ default: () => <div>Dashboard</div> }))
vi.mock('../pages/admin/Empleados', () => ({ default: () => <div>Empleados</div> }))
vi.mock('../pages/admin/Mesas', () => ({ default: () => <div>Mesas</div> }))
vi.mock('../pages/admin/Categorias', () => ({ default: () => <div>Categorias</div> }))
vi.mock('../pages/admin/Productos', () => ({ default: () => <div>Productos</div> }))
vi.mock('../pages/admin/Ingredientes', () => ({ default: () => <div>Ingredientes</div> }))
vi.mock('../pages/admin/Liquidaciones', () => ({ default: () => <div>Liquidaciones</div> }))
vi.mock('../pages/admin/Reportes', () => ({ default: () => <div>Reportes</div> }))
vi.mock('../pages/admin/Configuracion', () => ({ default: () => <div>Configuracion</div> }))
vi.mock('../pages/admin/CierreCaja', () => ({ default: () => <div>CierreCaja</div> }))
vi.mock('../pages/admin/Reservas', () => ({ default: () => <div>Reservas</div> }))
vi.mock('../pages/admin/Modificadores', () => ({ default: () => <div>Modificadores</div> }))
vi.mock('../pages/admin/TransaccionesMercadoPago', () => ({ default: () => <div>TransaccionesMP</div> }))
vi.mock('../pages/mozo/MozoMesas', () => ({ default: () => <div>MozoMesas</div> }))
vi.mock('../pages/mozo/NuevoPedido', () => ({ default: () => <div>NuevoPedido</div> }))
vi.mock('../pages/admin/Pedidos', () => ({ default: () => <div>Pedidos</div> }))
vi.mock('../pages/cocina/Cocina', () => ({ default: () => <div>Cocina</div> }))
vi.mock('../pages/delivery/DeliveryPedidos', () => ({ default: () => <div>DeliveryPedidos</div> }))

describe('App routing', () => {
  it('redirige /menu a /menu/default', () => {
    authState = { usuario: null, loading: false }
    render(
      <MemoryRouter initialEntries={['/menu']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('MenuPublico:default')).toBeInTheDocument()
  })

  it('redirige a login cuando no hay usuario', () => {
    authState = { usuario: null, loading: false }
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('LoginPage')).toBeInTheDocument()
  })

  it('permite dashboard para ADMIN', () => {
    authState = { usuario: { rol: 'ADMIN' }, loading: false }
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
