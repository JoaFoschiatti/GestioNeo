import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para manejar errores
api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error?.message || 'Error de conexión'

    // Si es error 401 y no es la ruta de login, redirigir
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Mostrar toast de error
    toast.error(message)

    return Promise.reject(error)
  }
)

export default api
