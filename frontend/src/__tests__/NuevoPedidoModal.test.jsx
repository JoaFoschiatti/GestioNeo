import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import NuevoPedidoModal from '../components/pedidos/NuevoPedidoModal'
import api from '../services/api'
import toast from 'react-hot-toast'

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

describe('NuevoPedidoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga datos, agrega producto y crea pedido', async () => {
    const categorias = [
      {
        id: 1,
        nombre: 'Bebidas',
        productos: [
          {
            id: 10,
            nombre: 'Coca',
            precio: 100,
            disponible: true
          }
        ]
      }
    ]
    const mesas = [{ id: 1, numero: 1, zona: null, estado: 'LIBRE' }]

    api.get.mockImplementation((url) => {
      if (url === '/categorias/publicas') return Promise.resolve({ data: categorias })
      if (url === '/mesas') return Promise.resolve({ data: mesas })
      if (url === '/modificadores/producto/10') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })

    api.post.mockResolvedValueOnce({ data: { id: 123 } })

    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const user = userEvent.setup()

    render(<NuevoPedidoModal isOpen onClose={onClose} onSuccess={onSuccess} />)

    expect(await screen.findByText('Bebidas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Coca/i }))

    expect(toast.success).toHaveBeenCalledWith('Coca agregado')

    await user.click(screen.getByRole('button', { name: /Crear Pedido/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({
          tipo: 'MOSTRADOR',
          mesaId: null,
          items: [expect.objectContaining({ productoId: 10, cantidad: 1 })]
        }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Pedido #123 creado!')
    expect(onSuccess).toHaveBeenCalled()
    expect(api.get).toHaveBeenCalledWith('/categorias/publicas', expect.objectContaining({ skipToast: true }))
    expect(api.get).toHaveBeenCalledWith('/mesas', expect.objectContaining({ skipToast: true }))
    expect(api.get).toHaveBeenCalledWith('/modificadores/producto/10', expect.objectContaining({ skipToast: true }))
  })
})
