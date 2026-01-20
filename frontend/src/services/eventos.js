export const createEventSource = () => {
  const token = localStorage.getItem('token')
  if (!token) return null

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
  const url = `${apiUrl}/eventos?token=${encodeURIComponent(token)}`
  return new EventSource(url)
}
