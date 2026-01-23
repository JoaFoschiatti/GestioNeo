import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Liquidaciones from '../pages/admin/Liquidaciones'
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

describe('Liquidaciones page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea una liquidación desde el modal', async () => {
    const empleados = [
      { id: 1, nombre: 'Ana', apellido: 'Lopez', rol: 'MOZO', tarifaHora: '10' }
    ]

    api.get.mockImplementation((url) => {
      if (url === '/liquidaciones') return Promise.resolve({ data: [] })
      if (url === '/empleados?activo=true') return Promise.resolve({ data: empleados })
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<Liquidaciones />)

    await user.click(await screen.findByRole('button', { name: /Nueva Liquidación/i }))

    await user.selectOptions(screen.getByLabelText('Empleado'), '1')
    await user.type(screen.getByLabelText('Período Desde'), '2024-01-01')
    await user.type(screen.getByLabelText('Período Hasta'), '2024-01-31')
    await user.type(screen.getByLabelText('Horas trabajadas'), '10')

    await user.click(screen.getByRole('button', { name: /Crear Liquidación/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/liquidaciones', {
        empleadoId: 1,
        periodoDesde: '2024-01-01',
        periodoHasta: '2024-01-31',
        horasTotales: 10,
        descuentos: 0,
        adicionales: 0,
        observaciones: ''
      })
    })

    expect(toast.success).toHaveBeenCalledWith('Liquidación creada')
  })

  it('marca una liquidación como pagada', async () => {
    const liquidaciones = [
      {
        id: 3,
        empleado: { nombre: 'Ana', apellido: 'Lopez' },
        periodoDesde: '2024-01-01T00:00:00.000Z',
        periodoHasta: '2024-01-31T00:00:00.000Z',
        horasTotales: '10',
        totalPagar: '100',
        pagado: false
      }
    ]

    api.get.mockImplementation((url) => {
      if (url === '/liquidaciones') return Promise.resolve({ data: liquidaciones })
      if (url === '/empleados?activo=true') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    api.patch.mockResolvedValueOnce({ data: { id: 3 } })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Liquidaciones />)

    await user.click(await screen.findByRole('button', { name: /Marcar liquidación #3 como pagada/i }))

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/liquidaciones/3/pagar')
    })

    expect(toast.success).toHaveBeenCalledWith('Marcada como pagada')
    confirmSpy.mockRestore()
  })
})

