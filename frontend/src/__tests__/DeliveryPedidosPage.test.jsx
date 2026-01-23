import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DeliveryPedidos from '../pages/delivery/DeliveryPedidos'
import api from '../services/api'
import toast from 'react-hot-toast'
import { createEventSource } from '../services/eventos'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
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

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

const buildPedido = (overrides = {}) => ({
  id: 1,
  estado: 'LISTO',
  clienteNombre: 'Ana',
  clienteTelefono: '123',
  clienteDireccion: 'Calle 1',
  items: [{ cantidad: 1, producto: { nombre: 'Pizza' } }],
  total: '1000',
  createdAt: new Date().toISOString(),
  ...overrides
})

describe('DeliveryPedidos page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEventSource.mockReturnValue(null)
  })

  it('carga pedidos y muestra datos', async () => {
    api.get.mockResolvedValueOnce({ data: [buildPedido()] })

    render(<DeliveryPedidos />)

    expect(await screen.findByText('Pedido #1')).toBeInTheDocument()
    expect(screen.getByText(/Pizza/i)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/pedidos/delivery', { skipToast: true })
  })

  it('muestra error de carga y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ data: [buildPedido({ id: 2 })] })

    const user = userEvent.setup()
    render(<DeliveryPedidos />)

    expect(
      await screen.findByRole('heading', { name: /No pudimos cargar los pedidos/i })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('Pedido #2')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('marca pedido como entregado', async () => {
    api.get.mockResolvedValueOnce({ data: [buildPedido()] })
    api.patch.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    render(<DeliveryPedidos />)

    await screen.findByText('Pedido #1')
    await user.click(screen.getByRole('button', { name: /Marcar como Entregado/i }))

    expect(api.patch).toHaveBeenCalledWith(
      '/pedidos/1/estado',
      { estado: 'ENTREGADO' },
      { skipToast: true }
    )
    expect(toast.success).toHaveBeenCalledWith('Pedido entregado')

    await waitFor(() => {
      expect(screen.queryByText('Pedido #1')).not.toBeInTheDocument()
    })
  })
})
