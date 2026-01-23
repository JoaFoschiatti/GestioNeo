import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import RedirectByRole from '../components/RedirectByRole'

let authState = { usuario: null, loading: false }

const LocationDisplay = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderRedirect = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RedirectByRole />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  )
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState
}))

describe('RedirectByRole', () => {
  it('muestra loader cuando esta cargando', () => {
    authState = { usuario: null, loading: true }
    const { container } = renderRedirect()

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('redirige a login si no hay usuario', () => {
    authState = { usuario: null, loading: false }
    renderRedirect()

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it.each([
    ['ADMIN', '/dashboard'],
    ['MOZO', '/mozo/mesas'],
    ['COCINERO', '/cocina'],
    ['CAJERO', '/dashboard'],
    ['DELIVERY', '/delivery/pedidos']
  ])('redirige %s a %s', (rol, destino) => {
    authState = { usuario: { rol }, loading: false }
    renderRedirect()

    expect(screen.getByTestId('location')).toHaveTextContent(destino)
  })
})
