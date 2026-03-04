import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import MozoMesas from '../pages/mozo/MozoMesas'
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

describe('MozoMesas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEventSource.mockReturnValue(null)
  })

  it('carga mesas y reservas proximas', async () => {
    api.get
      .mockResolvedValueOnce({
        data: [
          { id: 1, numero: 1, capacidad: 4, estado: 'LIBRE', zona: 'Salon' },
          { id: 2, numero: 2, capacidad: 2, estado: 'OCUPADA', zona: 'Salon', pedidos: [{ id: 99 }] }
        ]
      })
      .mockResolvedValueOnce({
        data: [{ id: 10, mesaId: 1, fechaHora: new Date().toISOString(), clienteNombre: 'Ana' }]
      })

    render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    expect(await screen.findByText('Salon')).toBeInTheDocument()
    expect(screen.getByText('Pedido #99')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/mesas?activa=true', { skipToast: true })
    expect(api.get).toHaveBeenCalledWith('/reservas/proximas', { skipToast: true })
  })

  it('muestra error de carga y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockRejectedValueOnce(new Error('fail mesas'))
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ id: 3, numero: 3, capacidad: 4, estado: 'LIBRE', zona: 'Patio' }]
      })
      .mockResolvedValueOnce({ data: [] })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <MozoMesas />
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('heading', { name: /No pudimos cargar las mesas/i })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('Patio')).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
