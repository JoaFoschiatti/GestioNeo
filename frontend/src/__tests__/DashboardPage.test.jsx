import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Dashboard from '../pages/admin/Dashboard'
import api from '../services/api'
import { createEventSource } from '../services/eventos'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('../services/eventos', () => ({
  createEventSource: vi.fn()
}))

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEventSource.mockReturnValue(null)
  })

  it('carga dashboard y muestra estadisticas', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        ventasHoy: 100,
        pedidosHoy: 2,
        pedidosPendientes: 1,
        mesasOcupadas: 2,
        mesasTotal: 5,
        alertasStock: 3,
        empleadosTrabajando: 4
      }
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/reportes/dashboard', expect.objectContaining({ skipToast: true }))
    })
  })

  it('muestra error y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        data: {
          ventasHoy: 50,
          pedidosHoy: 1,
          pedidosPendientes: 0,
          mesasOcupadas: 1,
          mesasTotal: 4,
          alertasStock: 0,
          empleadosTrabajando: 2
        }
      })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    expect(await screen.findByText('Error al cargar dashboard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('$50')).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
