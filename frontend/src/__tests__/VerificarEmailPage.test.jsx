import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import VerificarEmail from '../pages/VerificarEmail'
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

const renderPage = (token = 'abc') => {
  return render(
    <MemoryRouter initialEntries={[`/verificar-email/${token}`]}>
      <Routes>
        <Route path="/verificar-email/:token" element={<VerificarEmail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('VerificarEmail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra confirmacion cuando el token es valido', async () => {
    api.post.mockResolvedValueOnce({ data: { tenant: { slug: 'demo' } } })

    renderPage('token123')

    expect(await screen.findByText(/Cuenta Verificada/i)).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/registro/verificar/token123', null, { skipToast: true })
    expect(screen.getByRole('link', { name: /Iniciar Sesion/i })).toHaveAttribute('href', '/login/demo')
  })

  it('permite reintentar cuando falla la verificacion', async () => {
    api.post
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Token vencido' } } } })
      .mockResolvedValueOnce({ data: { tenant: { slug: 'demo' } } })

    const user = userEvent.setup()
    renderPage('token123')

    expect(await screen.findByText(/Error de verificacion/i)).toBeInTheDocument()
    expect(screen.getByText('Token vencido')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/i }))

    expect(await screen.findByText(/Cuenta Verificada/i)).toBeInTheDocument()
  })
})
