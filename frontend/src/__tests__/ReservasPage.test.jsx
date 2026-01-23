import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Reservas from '../pages/admin/Reservas'
import api from '../services/api'
import toast from 'react-hot-toast'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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

describe('Reservas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea una reserva desde el modal', async () => {
    const reserva = {
      id: 1,
      fechaHora: new Date().toISOString(),
      mesaId: 1,
      mesa: { numero: 1, zona: null },
      clienteNombre: 'Juan',
      clienteTelefono: null,
      cantidadPersonas: 2,
      observaciones: '',
      estado: 'CONFIRMADA'
    }

    api.get
      .mockResolvedValueOnce({ data: [{ id: 1, numero: 1, zona: null, capacidad: 4, activa: true }] }) // /mesas
      .mockResolvedValueOnce({ data: [] }) // /reservas (initial)
      .mockResolvedValueOnce({ data: [reserva] }) // /reservas (after create)

    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<Reservas />)

    await user.click(screen.getByRole('button', { name: /Nueva Reserva/i }))

    const mesaSelect = await screen.findByLabelText('Mesa')
    await screen.findByRole('option', { name: /Mesa 1/i })
    await user.selectOptions(mesaSelect, '1')
    await user.type(screen.getByLabelText('Nombre del cliente'), 'Juan')

    await user.click(screen.getByRole('button', { name: /Crear Reserva/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/reservas',
        expect.objectContaining({ mesaId: 1, clienteNombre: 'Juan' }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Reserva creada')
    expect(await screen.findByText('Juan')).toBeInTheDocument()
  })
})
