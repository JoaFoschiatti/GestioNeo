import axios from 'axios'
import toast from 'react-hot-toast'
import { getCached, setCache } from './offline/cache'
import { enqueue, countPending } from './offline/outbox'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Enable sending httpOnly cookies with requests
})

// Cache TTL por ruta (ms) - solo GETs
const CACHE_TTL_MAP = {
  '/categorias/publicas': 30 * 60 * 1000,
  '/mesas': 5 * 60 * 1000,
  '/pedidos/cocina': 60 * 1000,
  '/reservas/proximas': 5 * 60 * 1000
}

function getCacheTTL(url) {
  for (const [pattern, ttl] of Object.entries(CACHE_TTL_MAP)) {
    if (url.startsWith(pattern)) return ttl
  }
  return null
}

// Interceptor de respuesta exitosa: cachear GETs automaticamente
api.interceptors.response.use(
  async (response) => {
    const method = (response.config.method || 'get').toLowerCase()
    const url = response.config.url || ''
    if (method === 'get') {
      const ttl = getCacheTTL(url)
      if (ttl) {
        try {
          await setCache(`api:${url}`, response.data, ttl)
        } catch {
          // Cache write failure is non-critical
        }
      }
    }
    return response
  },
  async (error) => {
    const config = error.config || {}
    const method = (config.method || 'get').toLowerCase()
    const url = config.url || ''
    const isNetworkError = !error.response &&
      (error.code === 'ERR_NETWORK' || error.message === 'Network Error')

    // Para GETs con error de red, intentar servir desde cache
    if (isNetworkError && method === 'get') {
      try {
        const cached = await getCached(`api:${url}`)
        if (cached) {
          return { data: cached, status: 200, config, _fromCache: true }
        }
      } catch {
        // Cache read failure, fall through
      }
    }

    // Offline queue para mutaciones
    if (isNetworkError && config.offlineCapable) {
      try {
        const entry = await enqueue(config)
        const pending = await countPending()
        // Dispatch event for OfflineContext to update pending count
        window.dispatchEvent(new CustomEvent('offline:pending-changed', { detail: { count: pending } }))
        toast('Guardado offline. Se sincronizara al reconectar.', { icon: '📡', duration: 3000 })
        return {
          data: config._optimisticResponse || {},
          status: 202,
          statusText: 'Queued Offline',
          config,
          _offline: true,
          _outboxId: entry.id,
          _tempId: entry.tempId
        }
      } catch {
        // If outbox write fails, fall through to normal error handling
      }
    }

    const message = error.response?.data?.error?.message || 'Error de conexion'
    const errorCode = error.response?.data?.error?.code
    const skipToast = Boolean(config.skipToast)

    // Si es error 401 y no es la ruta de login, redirigir
    if (error.response?.status === 401 && !config.url.includes('/auth/login')) {
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

    // Mostrar toast de error (no mostrar si es error de red y ya servimos cache)
    if (!skipToast && !isNetworkError) {
      toast.error(message)
    }

    return Promise.reject(error)
  }
)

export default api
