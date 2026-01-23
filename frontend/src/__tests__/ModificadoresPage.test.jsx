import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import Modificadores from '../pages/admin/Modificadores'
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

describe('Modificadores page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('separa exclusiones y adiciones', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        { id: 1, nombre: 'Cebolla', tipo: 'EXCLUSION', precio: 0, activo: true },
        { id: 2, nombre: 'Queso', tipo: 'ADICION', precio: 100.5, activo: true }
      ]
    })

    render(<Modificadores />)

    expect(await screen.findByText('Sin Cebolla')).toBeInTheDocument()
    expect(screen.getByText('Extra Queso')).toBeInTheDocument()
    expect(screen.getByText('+$100,50')).toBeInTheDocument()
  })
})

