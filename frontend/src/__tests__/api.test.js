import { describe, it, expect, beforeEach, vi } from 'vitest'
import toast from 'react-hot-toast'
import '../services/api'

const handlerRef = vi.hoisted(() => ({ current: null }))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        response: {
          use: vi.fn((_, failure) => {
            handlerRef.current = failure
          })
        }
      },
      defaults: { headers: { common: {} } }
    }))
  }
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn()
  }
}))

describe('api interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.removeItem.mockReset()
    window.location.href = ''
  })

  it('redirige y limpia sesion en 401', async () => {
    const error = {
      response: { status: 401, data: { error: { message: 'Token expirado' } } },
      config: { url: '/api/pedidos' }
    }

    await expect(handlerRef.current(error)).rejects.toBe(error)

    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('usuario')
    expect(window.location.href).toBe('/login')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('muestra toast cuando no es 401', async () => {
    const error = {
      response: { status: 500, data: { error: { message: 'Fallo' } } },
      config: { url: '/api/test' }
    }

    await expect(handlerRef.current(error)).rejects.toBe(error)

    expect(toast.error).toHaveBeenCalledWith('Fallo')
  })

  it('omite toast cuando skipToast es true', async () => {
    const error = {
      response: { status: 400, data: { error: { message: 'Bad' } } },
      config: { url: '/api/test', skipToast: true }
    }

    await expect(handlerRef.current(error)).rejects.toBe(error)

    expect(toast.error).not.toHaveBeenCalled()
  })
})
