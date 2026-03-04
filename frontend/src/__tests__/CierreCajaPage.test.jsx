import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CierreCaja from '../pages/admin/CierreCaja'
import api from '../services/api'
import toast from 'react-hot-toast'

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

describe('CierreCaja page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('abre caja desde el modal', async () => {
    api.get
      .mockResolvedValueOnce({ data: { cajaAbierta: false } }) // /cierres/actual
      .mockResolvedValueOnce({ data: [] }) // /cierres?limit=10
      .mockResolvedValueOnce({
        data: {
          cajaAbierta: true,
          caja: {
            id: 1,
            fondoInicial: 100,
            ventasActuales: { efectivo: 0, tarjeta: 0, mercadopago: 0 },
            usuario: { nombre: 'Admin' },
            horaApertura: new Date().toISOString()
          }
        }
      }) // /cierres/actual (after open)
      .mockResolvedValueOnce({ data: [] }) // /cierres?limit=10 (after open)

    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<CierreCaja />)

    await user.click(await screen.findByRole('button', { name: /Abrir Caja/i }))

    await user.type(
      screen.getByLabelText(/Fondo Inicial \(efectivo en caja\)/i),
      '100'
    )

    const submitButton = screen
      .getAllByRole('button', { name: /^Abrir Caja$/i })
      .find(btn => btn.getAttribute('type') === 'submit')

    expect(submitButton).toBeTruthy()
    await user.click(submitButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/cierres',
        expect.objectContaining({ fondoInicial: 100 }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Caja abierta correctamente')
    expect(await screen.findByText(/Caja Abierta/i)).toBeInTheDocument()
  })
})

