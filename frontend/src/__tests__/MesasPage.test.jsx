import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Mesas from '../pages/admin/Mesas'
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

describe('Mesas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea una mesa desde el modal', async () => {
    api.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [
          { id: 1, numero: 1, zona: '', capacidad: 4, estado: 'LIBRE', activa: true }
        ]
      })
    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<Mesas />)

    await user.click(await screen.findByRole('button', { name: /Nueva Mesa/i }))

    await user.type(screen.getByLabelText('Número de Mesa'), '1')
    await user.clear(screen.getByLabelText('Capacidad'))
    await user.type(screen.getByLabelText('Capacidad'), '4')

    await user.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/mesas',
        expect.objectContaining({ numero: 1, capacidad: 4, zona: '' }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Mesa creada')
  })

  it('desactiva una mesa desde la tarjeta', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: 2, numero: 2, zona: 'Interior', capacidad: 4, estado: 'LIBRE', activa: true }
      ]
    })
    api.delete.mockResolvedValueOnce({ data: { id: 2 } })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Mesas />)

    await user.click(await screen.findByRole('button', { name: /Desactivar mesa 2/i }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/mesas/2', expect.objectContaining({ skipToast: true }))
    })

    expect(toast.success).toHaveBeenCalledWith('Mesa desactivada')
    confirmSpy.mockRestore()
  })
})
