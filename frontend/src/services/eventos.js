import api from './api'
import { API_URL } from '../config/constants'

export const createEventSource = async () => {
  try {
    // Primero intentar con cookie httpOnly (más seguro, no expone token en URL)
    const cookieSource = new EventSource(`${API_URL}/eventos`, { withCredentials: true })

    // Esperar brevemente para ver si la conexión con cookie funciona
    const cookieWorks = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cookieSource.close()
        resolve(false)
      }, 3000)
      cookieSource.onopen = () => {
        clearTimeout(timeout)
        resolve(true)
      }
      cookieSource.onerror = () => {
        clearTimeout(timeout)
        cookieSource.close()
        resolve(false)
      }
    })

    if (cookieWorks) return cookieSource

    // Fallback: obtener token SSE de corta duración (30s) para query param
    const { data } = await api.post('/auth/sse-token')
    const sseToken = data.sseToken
    if (!sseToken) return null

    const url = `${API_URL}/eventos?token=${encodeURIComponent(sseToken)}`
    return new EventSource(url)
  } catch {
    return null
  }
}
