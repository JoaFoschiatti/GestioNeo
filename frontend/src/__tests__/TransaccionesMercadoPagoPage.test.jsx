import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import TransaccionesMercadoPago from '../pages/admin/TransaccionesMercadoPago'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

describe('TransaccionesMercadoPago page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga transacciones y aplica filtro por estado', async () => {
    const transaccion = {
      id: 1,
      createdAt: new Date().toISOString(),
      amount: 100,
      fee: 5,
      netAmount: 95,
      status: 'approved',
      paymentMethod: 'credit_card',
      installments: 1,
      payerEmail: 'cliente@test.com',
      pago: { pedido: { id: 9 } }
    }

    api.get.mockImplementation((_url, config) => {
      const page = config?.params?.page || 1
      return Promise.resolve({
        data: {
          transacciones: [transaccion],
          totales: { bruto: 100, comisiones: 5, neto: 95, cantidadAprobadas: 1 },
          pagination: { page, pages: 3, total: 3 }
        }
      })
    })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TransaccionesMercadoPago />
      </MemoryRouter>
    )

    expect(await screen.findByText('Transacciones MercadoPago')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#9' })).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Siguiente/i }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/mercadopago/transacciones',
        expect.objectContaining({
          params: expect.objectContaining({ page: 2, limit: 20 }),
          skipToast: true
        })
      )
    })

    await user.click(screen.getByRole('button', { name: /Filtros/i }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'approved')

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        '/mercadopago/transacciones',
        expect.objectContaining({
          params: expect.objectContaining({ status: 'approved', page: 1, limit: 20 }),
          skipToast: true
        })
      )
    })
  })
})
