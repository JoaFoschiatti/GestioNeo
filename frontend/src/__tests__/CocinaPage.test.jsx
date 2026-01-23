import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Cocina from '../pages/cocina/Cocina'
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

describe('Cocina page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEventSource.mockReturnValue(null)
    localStorage.getItem.mockReturnValue('false')
  })

  it('carga pedidos y muestra contadores', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          estado: 'PENDIENTE',
          tipo: 'MESA',
          mesa: { numero: 5 },
          createdAt: new Date().toISOString(),
          items: []
        },
        {
          id: 2,
          estado: 'EN_PREPARACION',
          tipo: 'DELIVERY',
          createdAt: new Date().toISOString(),
          items: []
        }
      ]
    })

    render(<Cocina />)

    expect(await screen.findByText('Cocina')).toBeInTheDocument()
    expect(screen.getByText(/Pendientes:\s*1/i)).toBeInTheDocument()
    expect(screen.getByText(/En preparación:\s*1/i)).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('muestra error de carga y permite reintentar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        data: [
          {
            id: 3,
            estado: 'PENDIENTE',
            tipo: 'MOSTRADOR',
            createdAt: new Date().toISOString(),
            items: []
          }
        ]
      })

    const user = userEvent.setup()
    render(<Cocina />)

    expect(
      await screen.findByRole('heading', { name: /No pudimos cargar los pedidos/i })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText('#3')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
