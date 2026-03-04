import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import MercadoPagoConfig from '../components/configuracion/MercadoPagoConfig'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

describe('MercadoPagoConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('permite configurar manualmente el access token', async () => {
    api.get.mockResolvedValueOnce({
      data: { connected: false, config: null }
    })
    api.post.mockResolvedValueOnce({
      data: { email: 'test@mercadopago.com' }
    })

    const onStatusChange = vi.fn()
    const user = userEvent.setup()
    render(<MercadoPagoConfig onStatusChange={onStatusChange} />)

    expect(await screen.findByText('No hay cuenta conectada')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Configuracion manual/i }))
    await user.type(screen.getByLabelText('Access Token'), 'APP_USR-123')
    await user.click(screen.getByRole('button', { name: /Guardar configuracion/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/mercadopago/config/manual',
        { accessToken: 'APP_USR-123' },
        expect.objectContaining({ skipToast: true })
      )
    })

    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument()
    expect(onStatusChange).toHaveBeenCalledWith(true)
  })
})

