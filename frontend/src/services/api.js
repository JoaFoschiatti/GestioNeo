import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Enable sending httpOnly cookies with requests
})

// Interceptor para manejar errores
api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error?.message || 'Error de conexión'
    const errorCode = error.response?.data?.error?.code
    const skipToast = Boolean(error.config?.skipToast)

    // Si es error 401 y no es la ruta de login, redirigir
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      // Clear localStorage auth info
      localStorage.removeItem('usuario')
      localStorage.removeItem('negocio')
      localStorage.removeItem('suscripcion')
      localStorage.removeItem('modoSoloLectura')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Manejar error de suscripcion requerida
    if (errorCode === 'SUBSCRIPTION_REQUIRED') {
      if (!skipToast) {
        toast.error('Tu suscripcion no esta activa. Activa tu plan para realizar esta accion.', {
          duration: 5000,
          icon: '🔒'
        })
      }
      return Promise.reject(error)
    }

    // Mostrar toast de error
    if (!skipToast) {
      toast.error(message)
    }

    return Promise.reject(error)
  }
)

export default api
