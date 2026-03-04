import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import Ingredientes from '../pages/admin/Ingredientes'
import api from '../services/api'

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

describe('Ingredientes page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marca en rojo los ingredientes con stock bajo', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          nombre: 'Harina',
          unidad: 'kg',
          stockActual: 1,
          stockMinimo: 2,
          costo: null,
          activo: true
        },
        {
          id: 2,
          nombre: 'Sal',
          unidad: 'kg',
          stockActual: 5,
          stockMinimo: 1,
          costo: 10,
          activo: true
        }
      ]
    })

    render(<Ingredientes />)

    const harinaRow = (await screen.findByText('Harina')).closest('tr')
    const salRow = screen.getByText('Sal').closest('tr')

    expect(harinaRow).toHaveClass('bg-red-50')
    expect(salRow).not.toHaveClass('bg-red-50')
  })
})

