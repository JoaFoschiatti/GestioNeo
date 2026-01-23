import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Productos from '../pages/admin/Productos'
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

describe('Productos page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga productos (vista agrupada) y categorias', async () => {
    const categoria = { id: 10, nombre: 'Platos' }
    const producto = {
      id: 1,
      nombre: 'Milanesa',
      precio: 1000,
      categoriaId: 10,
      categoria,
      disponible: true,
      destacado: false,
      productoBaseId: null,
      variantes: []
    }

    api.get.mockImplementation((url) => {
      if (url === '/productos/con-variantes') return Promise.resolve({ data: [producto] })
      if (url === '/categorias') return Promise.resolve({ data: [categoria] })
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })

    render(<Productos />)

    expect(await screen.findByText('Milanesa')).toBeInTheDocument()
    expect(screen.getByText('Platos')).toBeInTheDocument()

    expect(api.get).toHaveBeenCalledWith('/productos/con-variantes', expect.objectContaining({ skipToast: true }))
    expect(api.get).toHaveBeenCalledWith('/categorias', expect.objectContaining({ skipToast: true }))
  })

  it('cambia a vista plana', async () => {
    const categoria = { id: 10, nombre: 'Platos' }
    const productoAgrupado = {
      id: 1,
      nombre: 'Milanesa',
      precio: 1000,
      categoriaId: 10,
      categoria,
      disponible: true,
      destacado: false,
      productoBaseId: null,
      variantes: []
    }
    const productoPlano = {
      id: 2,
      nombre: 'Empanada',
      precio: 500,
      categoriaId: 10,
      categoria,
      disponible: true,
      destacado: false,
      productoBaseId: null
    }

    api.get.mockImplementation((url) => {
      if (url === '/productos/con-variantes') return Promise.resolve({ data: [productoAgrupado] })
      if (url === '/productos') return Promise.resolve({ data: [productoPlano] })
      if (url === '/categorias') return Promise.resolve({ data: [categoria] })
      return Promise.reject(new Error(`Unexpected url: ${url}`))
    })

    const user = userEvent.setup()
    render(<Productos />)

    expect(await screen.findByText('Milanesa')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Vista plana/i }))

    expect(await screen.findByText('Empanada')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/productos', expect.objectContaining({ skipToast: true }))
  })

  it('crea un producto desde el modal', async () => {
    const categoria = { id: 10, nombre: 'Platos' }
    const producto = {
      id: 1,
      nombre: 'Papas',
      precio: 100,
      categoriaId: 10,
      categoria,
      disponible: true,
      destacado: false,
      productoBaseId: null,
      variantes: []
    }

    api.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [categoria] })
      .mockResolvedValueOnce({ data: [producto] })
      .mockResolvedValueOnce({ data: [categoria] })

    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<Productos />)

    await user.click(await screen.findByRole('button', { name: /Nuevo Producto/i }))

    await user.type(screen.getByLabelText('Nombre'), 'Papas')
    await user.type(screen.getByLabelText('Precio ($)'), '100')
    await user.selectOptions(screen.getByLabelText('Categoria'), '10')

    await user.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/productos',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'multipart/form-data' })
        })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Producto creado')
  })
})

