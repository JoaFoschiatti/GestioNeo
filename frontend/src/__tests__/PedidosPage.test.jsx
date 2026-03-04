import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Pedidos from '../pages/admin/Pedidos'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { createEventSource } from '../services/eventos'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

vi.mock('../components/pedidos/NuevoPedidoModal', () => ({
  default: () => null
}))

describe('Pedidos page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ usuario: { rol: 'ADMIN' } })
    createEventSource.mockReturnValue(null)
  })

  it('carga pedidos y aplica filtro por estado', async () => {
    const pedido = {
      id: 1,
      tipo: 'MOSTRADOR',
      total: '100',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: null,
      clienteNombre: 'Mostrador',
      pagos: []
    }

    api.get
      .mockResolvedValueOnce({ data: [pedido] })
      .mockResolvedValueOnce({ data: [pedido] })

    const user = userEvent.setup()
    render(<Pedidos />)

    expect(await screen.findByText('#1')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDIENTE')

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/pedidos?estado=PENDIENTE')
    })
  })

  it('abre detalle y registra pago', async () => {
    const pedido = {
      id: 9,
      tipo: 'MESA',
      total: '200',
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString(),
      impresion: null,
      mesa: { numero: 3 },
      clienteNombre: null,
      usuario: { nombre: 'Ana' },
      pagos: []
    }
    const pedidoDetalle = {
      ...pedido,
      items: [
        {
          id: 1,
          cantidad: 1,
          subtotal: '200',
          producto: { nombre: 'Pizza' }
        }
      ]
    }

    api.get.mockImplementation((url) => {
      if (url === '/pedidos') return Promise.resolve({ data: [pedido] })
      if (url === `/pedidos/${pedido.id}`) return Promise.resolve({ data: pedidoDetalle })
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<Pedidos />)

    expect(await screen.findByText('#9')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Ver detalle del pedido #${pedido.id}` }))
    expect(await screen.findByText(`Pedido #${pedido.id}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Registrar pago del pedido #${pedido.id}` }))
    await user.click(screen.getByRole('button', { name: 'Registrar Pago' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pagos', {
        pedidoId: pedido.id,
        monto: 200,
        metodo: 'EFECTIVO',
        referencia: null
      })
    })

    expect(toast.success).toHaveBeenCalledWith('Pago registrado')
  })
})
