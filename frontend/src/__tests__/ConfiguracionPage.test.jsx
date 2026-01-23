import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Configuracion from '../pages/admin/Configuracion'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('../components/configuracion/MercadoPagoConfig', () => ({
  default: () => <div data-testid="mercadopago-config" />
}))

describe('Configuracion page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga datos y guarda configuracion', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          slug: 'mi-local',
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: {
          tienda_abierta: 'true',
          horario_apertura: '09:00',
          horario_cierre: '18:00',
          nombre_negocio: 'Mi Local',
          costo_delivery: '0',
          delivery_habilitado: 'true',
          efectivo_enabled: 'true'
        }
      })

    api.put.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    render(<Configuracion />)

    expect(await screen.findByLabelText(/Nombre del Negocio/i)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Nombre para mostrar en el Menu'))
    await user.type(screen.getByLabelText('Nombre para mostrar en el Menu'), 'Nuevo Nombre')

    await user.click(screen.getByRole('button', { name: /Guardar Configuracion/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/configuracion',
        expect.objectContaining({ nombre_negocio: 'Nuevo Nombre' }),
        expect.objectContaining({ skipToast: true })
      )
    })
  })

  it('valida slug invalido sin llamar a la API', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          slug: 'mi-local',
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: { tienda_abierta: 'true' }
      })

    const user = userEvent.setup()
    render(<Configuracion />)

    const slugInput = await screen.findByLabelText(/URL del Menu \(slug\)/i)
    await user.clear(slugInput)
    await user.type(slugInput, 'a')
    await user.tab()

    expect(await screen.findByText(/al menos 3 caracteres/i)).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/tenant/verificar-slug/'),
      expect.any(Object)
    )
  })

  it('muestra error cuando falla la subida del banner', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockResolvedValueOnce({
        data: {
          slug: 'mi-local',
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: { tienda_abierta: 'true' }
      })

    api.post.mockRejectedValueOnce(new Error('fail'))

    const user = userEvent.setup()
    render(<Configuracion />)

    const bannerInput = await screen.findByLabelText(/Banner del Menu Publico/i)
    const file = new File(['banner'], 'banner.png', { type: 'image/png' })

    await user.upload(bannerInput, file)

    expect(await screen.findByText(/Error al subir banner/i)).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
