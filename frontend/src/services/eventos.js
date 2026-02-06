import api from './api'
import { API_URL } from '../config/constants'

export const createEventSource = async () => {
  try {
    const { data } = await api.post('/auth/sse-token')
    const sseToken = data.sseToken
    if (!sseToken) return null

    const url = `${API_URL}/eventos?token=${encodeURIComponent(sseToken)}`
    return new EventSource(url)
  } catch {
    return null
  }
}
