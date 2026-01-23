import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import NuevoPedido from '../pages/mozo/NuevoPedido'
import api from '../services/api'
import toast from 'react-hot-toast'

const mockNavigate = vi.fn()
const mockUseParams = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams()
  }
})

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

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('NuevoPedido (mozo)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ mesaId: '5' })
  })

  it('carga datos, agrega producto y confirma pedido', async () => {
    const categorias = [
      {
        id: 1,
        nombre: 'Comidas',
        productos: [
          {
            id: 20,
            nombre: 'Pizza',
            precio: 1500,
            descripcion: 'Muzzarella',
            disponible: true
          }
        ]
      }
    ]

    api.get.mockImplementation((url) => {
      if (url === '/categorias/publicas') return Promise.resolve({ data: categorias })
      if (url === '/mesas/5') return Promise.resolve({ data: { id: 5, numero: 5 } })
      if (url === '/modificadores/producto/20') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })

    api.post.mockResolvedValueOnce({ data: { id: 55 } })

    const user = userEvent.setup()
    render(<NuevoPedido />)

    expect(await screen.findByText('Pizza')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pizza/i }))

    await user.click(screen.getByRole('button', { name: /Confirmar Pedido/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({
          tipo: 'MESA',
          mesaId: 5,
          items: [expect.objectContaining({ productoId: 20, cantidad: 1 })]
        }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith(
      'Pedido #55 creado! Se imprimira al iniciar preparacion.'
    )
    expect(mockNavigate).toHaveBeenCalledWith('/mozo/mesas')
    expect(api.get).toHaveBeenCalledWith('/categorias/publicas', expect.objectContaining({ skipToast: true }))
    expect(api.get).toHaveBeenCalledWith('/mesas/5', expect.objectContaining({ skipToast: true }))
    expect(api.get).toHaveBeenCalledWith('/modificadores/producto/20', expect.objectContaining({ skipToast: true }))
  })
})
