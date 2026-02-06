import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEventSource } from '../services/eventos'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn()
  }
}))

vi.mock('../config/constants', () => ({
  API_URL: 'http://localhost:3001/api'
}))

import api from '../services/api'

describe('createEventSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.EventSource = vi.fn(function EventSource(url) {
      this.url = url
    })
  })

  it('retorna null si el endpoint falla', async () => {
    api.post.mockRejectedValue(new Error('Unauthorized'))

    const source = await createEventSource()

    expect(source).toBeNull()
    expect(global.EventSource).not.toHaveBeenCalled()
  })

  it('retorna null si no se recibe sseToken', async () => {
    api.post.mockResolvedValue({ data: {} })

    const source = await createEventSource()

    expect(source).toBeNull()
    expect(global.EventSource).not.toHaveBeenCalled()
  })

  it('crea EventSource con el sseToken en la URL', async () => {
    api.post.mockResolvedValue({ data: { sseToken: 'short-lived-token' } })

    const source = await createEventSource()
    const expectedUrl = `http://localhost:3001/api/eventos?token=${encodeURIComponent('short-lived-token')}`

    expect(api.post).toHaveBeenCalledWith('/auth/sse-token')
    expect(global.EventSource).toHaveBeenCalledTimes(1)
    expect(global.EventSource).toHaveBeenCalledWith(expectedUrl)
    expect(source.url).toBe(expectedUrl)
  })
})
