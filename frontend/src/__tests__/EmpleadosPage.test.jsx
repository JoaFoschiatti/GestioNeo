import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Empleados from '../pages/admin/Empleados'
import api from '../services/api'
import toast from 'react-hot-toast'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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

describe('Empleados page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea un empleado desde el modal', async () => {
    api.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            nombre: 'Ana',
            apellido: 'Lopez',
            dni: '123',
            telefono: '',
            rol: 'MOZO',
            tarifaHora: 10,
            activo: true
          }
        ]
      })

    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<Empleados />)

    await user.click(await screen.findByRole('button', { name: /Nuevo Empleado/i }))

    await user.type(screen.getByLabelText('Nombre'), 'Ana')
    await user.type(screen.getByLabelText('Apellido'), 'Lopez')
    await user.type(screen.getByLabelText('DNI'), '123')
    await user.type(screen.getByLabelText('Tarifa por Hora ($)'), '10')

    await user.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/empleados',
        expect.objectContaining({
          nombre: 'Ana',
          apellido: 'Lopez',
          dni: '123',
          rol: 'MOZO',
          tarifaHora: '10'
        }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Empleado creado')
  })

  it('desactiva un empleado desde la lista', async () => {
    api.get.mockResolvedValue({
      data: [
        {
          id: 2,
          nombre: 'Juan',
          apellido: 'Perez',
          dni: '999',
          telefono: '',
          rol: 'CAJERO',
          tarifaHora: 12,
          activo: true
        }
      ]
    })
    api.delete.mockResolvedValueOnce({ data: { id: 2 } })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Empleados />)

    await user.click(await screen.findByRole('button', { name: /Desactivar empleado: Juan Perez/i }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/empleados/2', expect.objectContaining({ skipToast: true }))
    })

    expect(toast.success).toHaveBeenCalledWith('Empleado desactivado')
    confirmSpy.mockRestore()
  })
})
