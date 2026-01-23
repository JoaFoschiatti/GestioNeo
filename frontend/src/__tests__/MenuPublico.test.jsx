import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import MenuPublico from '../pages/MenuPublico'

const API_URL = 'http://localhost:3001/api'

const configData = {
  tenant: {
    nombre_negocio: 'La Casa'
  },
  config: {
    tienda_abierta: true,
    delivery_habilitado: true,
    costo_delivery: 400,
    mercadopago_enabled: true,
    efectivo_enabled: true
  }
}

const menuData = [
  {
    id: 1,
    nombre: 'Pizzas',
    productos: [
      {
        id: 10,
        nombre: 'Muzzarella',
        descripcion: 'Pizza clasica',
        precio: '1200'
      }
    ]
  }
]

const renderMenu = (initialEntry = '/menu/demo') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/menu/:slug" element={<MenuPublico />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('MenuPublico page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    localStorage.getItem.mockReturnValue(null)
  })

  it('carga el menu y muestra productos', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    renderMenu()

    expect(await screen.findByText('La Casa')).toBeInTheDocument()
    expect(screen.getByText('Pizzas')).toBeInTheDocument()
    expect(screen.getByText('Muzzarella')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/publico/demo/config`, {})
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/publico/demo/menu`, {})
  })

  it('muestra error de carga y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Error al cargar configuracion' } })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    const user = userEvent.setup()
    renderMenu()

    expect(await screen.findByText(/Error al cargar configuracion/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('Muzzarella')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('muestra alerta cuando vuelve de MercadoPago con error', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => configData })
      .mockResolvedValueOnce({ ok: true, json: async () => menuData })

    renderMenu('/menu/demo?pago=error&pedido=123')

    expect(await screen.findByText(/El pago no pudo ser procesado/i)).toBeInTheDocument()
  })
})
