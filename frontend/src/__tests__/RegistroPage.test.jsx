import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Registro from '../pages/Registro'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

describe('Registro page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registra un restaurante y muestra pantalla de exito', async () => {
    api.post.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Registro />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText('Mi Restaurante'), 'Mi Restaurante')
    await user.click(screen.getByRole('button', { name: /Continuar/i }))

    await user.type(screen.getByPlaceholderText('Juan Perez'), 'Juan')
    await user.type(screen.getByPlaceholderText('tu@email.com'), 'juan@demo.com')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'secret123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'secret123')

    await user.click(screen.getByRole('button', { name: /Registrarme/i }))

    expect(api.post).toHaveBeenCalledWith(
      '/registro',
      expect.objectContaining({
        nombreRestaurante: 'Mi Restaurante',
        slug: 'mi-restaurante',
        nombre: 'Juan',
        email: 'juan@demo.com'
      }),
      { skipToast: true }
    )

    expect(await screen.findByText(/Registro Exitoso/i)).toBeInTheDocument()
  })

  it('muestra error cuando el registro falla', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { error: { message: 'Slug ocupado' } } }
    })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Registro />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText('Mi Restaurante'), 'Mi Restaurante')
    await user.click(screen.getByRole('button', { name: /Continuar/i }))

    await user.type(screen.getByPlaceholderText('Juan Perez'), 'Juan')
    await user.type(screen.getByPlaceholderText('tu@email.com'), 'juan@demo.com')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'secret123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'secret123')

    await user.click(screen.getByRole('button', { name: /Registrarme/i }))

    expect(await screen.findByText('Slug ocupado')).toBeInTheDocument()
  })
})
