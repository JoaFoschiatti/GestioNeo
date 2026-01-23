import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEventSource } from '../services/eventos'

describe('createEventSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.EventSource = vi.fn(function EventSource(url) {
      this.url = url
    })
  })

  it('retorna null si no hay token', () => {
    localStorage.getItem.mockReturnValue(null)

    const source = createEventSource()

    expect(source).toBeNull()
    expect(global.EventSource).not.toHaveBeenCalled()
  })

  it('crea EventSource con el token en la URL', () => {
    localStorage.getItem.mockReturnValue('abc 123')

    const source = createEventSource()
    const expectedUrl = `http://localhost:3001/api/eventos?token=${encodeURIComponent('abc 123')}`

    expect(global.EventSource).toHaveBeenCalledTimes(1)
    expect(global.EventSource).toHaveBeenCalledWith(expectedUrl)
    expect(source.url).toBe(expectedUrl)
  })
})
