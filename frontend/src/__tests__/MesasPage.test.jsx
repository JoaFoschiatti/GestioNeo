import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Mesas from '../pages/admin/Mesas'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() },
    },
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('Mesas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ usuario: { rol: 'ADMIN' } })
  })

  const renderPage = (initialEntries = ['/mesas']) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <Mesas />
      </MemoryRouter>
    )

  it('crea una mesa desde el modal', async () => {
    let mesasCallCount = 0
    api.get.mockImplementation(async (url) => {
      if (url === '/reservas/proximas') {
        return { data: [] }
      }

      if (url === '/mesas') {
        mesasCallCount += 1
        if (mesasCallCount === 1) {
          return { data: [] }
        }

        return {
          data: [
            { id: 1, numero: 1, zona: 'Interior', capacidad: 4, estado: 'LIBRE', activa: true },
          ],
        }
      }

      return { data: [] }
    })
    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Nueva Mesa/i }))

    await user.type(screen.getByLabelText('Numero de Mesa'), '1')
    await user.clear(screen.getByLabelText('Capacidad'))
    await user.type(screen.getByLabelText('Capacidad'), '4')

    await user.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/mesas',
        expect.objectContaining({ numero: 1, capacidad: 4, zona: 'Interior' }),
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Mesa creada')
  })

  it('desactiva una mesa desde la tarjeta', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/mesas') {
        return {
          data: [
            { id: 2, numero: 2, zona: 'Interior', capacidad: 4, estado: 'LIBRE', activa: true },
          ],
        }
      }

      return { data: [] }
    })
    api.delete.mockResolvedValueOnce({ data: { id: 2 } })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Desactivar mesa 2/i }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        '/mesas/2',
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Mesa desactivada')
    confirmSpy.mockRestore()
  })

  it('destaca la mesa enfocada desde query param', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/mesas') {
        return {
          data: [
            { id: 8, numero: 8, zona: 'Interior', capacidad: 4, estado: 'LIBRE', activa: true },
          ],
        }
      }

      return { data: [] }
    })

    renderPage(['/mesas?mesaId=8'])

    const mesaCard = await screen.findByText('8')
    expect(mesaCard.closest('#mesa-card-8')).toBeInTheDocument()
  })
})
