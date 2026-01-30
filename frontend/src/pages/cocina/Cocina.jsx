import { useState, useRef, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { CheckIcon, ClockIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline'
import usePolling from '../../hooks/usePolling'
import useEventSource from '../../hooks/useEventSource'
import useAsync from '../../hooks/useAsync'

// Función para reproducir sonido de notificación usando Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.value = 0.3

    oscillator.start()

    // Beep corto
    setTimeout(() => {
      oscillator.frequency.value = 1000
    }, 100)

    setTimeout(() => {
      oscillator.frequency.value = 800
    }, 200)

    setTimeout(() => {
      oscillator.stop()
      audioContext.close()
    }, 300)
  } catch (error) {
    console.error('Error reproduciendo sonido:', error)
  }
}

export default function Cocina() {
  const [pedidos, setPedidos] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('cocina_sound') !== 'false'
  })
  const pedidosRef = useRef([])

  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem('cocina_sound', newValue.toString())
    if (newValue) {
      // Reproducir sonido de prueba al activar
      playNotificationSound()
    }
  }

  const cargarPedidos = useCallback(async () => {
    const response = await api.get('/pedidos/cocina', { skipToast: true })
    const nuevosPedidos = response.data

    // Detectar nuevos pedidos PENDIENTES
    if (soundEnabled && pedidosRef.current.length > 0) {
      const idsAnteriores = new Set(pedidosRef.current.map(p => p.id))
      const hayNuevoPendiente = nuevosPedidos.some(
        p => p.estado === 'PENDIENTE' && !idsAnteriores.has(p.id)
      )
      if (hayNuevoPendiente) {
        playNotificationSound()
      }
    }

    pedidosRef.current = nuevosPedidos
    setPedidos(nuevosPedidos)
    setLoadError(null)
    return nuevosPedidos
  }, [soundEnabled])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    setLoadError('No pudimos cargar los pedidos.')
  }, [])

  const cargarPedidosRequest = useCallback(async (_ctx) => (
    cargarPedidos()
  ), [cargarPedidos])

  const { loading, execute: cargarPedidosAsync } = useAsync(
    cargarPedidosRequest,
    { onError: handleLoadError }
  )

  usePolling(cargarPedidosAsync, 10000, { immediate: false })

  useEventSource({
    events: {
      'pedido.updated': cargarPedidosAsync
    }
  })

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.patch(
        `/pedidos/${id}/estado`,
        { estado: nuevoEstado },
        { skipToast: true }
      )
      toast.success(nuevoEstado === 'EN_PREPARACION' ? 'Iniciando preparación' : 'Pedido listo!')
      cargarPedidosAsync().catch(() => {})
    } catch (error) {
      console.error('Error:', error)
      toast.error('No pudimos actualizar el pedido.')
    }
  }

  const getTiempoTranscurrido = (fecha) => {
    const minutos = Math.floor((Date.now() - new Date(fecha)) / 60000)
    if (minutos < 60) return `${minutos} min`
    return `${Math.floor(minutos / 60)}h ${minutos % 60}m`
  }

  if (loading && pedidos.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (loadError && pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClockIcon className="w-10 h-10 text-error-500 mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No pudimos cargar los pedidos</h2>
        <p className="text-sm text-text-secondary mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null)
            cargarPedidosAsync().catch(() => {})
          }}
          className="btn btn-primary"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const pedidosPendientes = pedidos.filter((p) => p.estado === 'PENDIENTE')
  const pedidosEnPreparacion = pedidos.filter((p) => p.estado === 'EN_PREPARACION')

  return (
    <div>
      {loadError && pedidos.length > 0 && (
        <div className="mb-4 bg-error-50 text-error-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ClockIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoadError(null)
              cargarPedidosAsync().catch(() => {})
            }}
            className="text-sm font-medium hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Cocina</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-text-secondary">
            <span className="w-3 h-3 bg-warning-400 rounded-full"></span>
            Pendientes: {pedidosPendientes.length}
          </span>
          <span className="flex items-center gap-1 text-text-secondary">
            <span className="w-3 h-3 bg-info-400 rounded-full"></span>
            En preparación: {pedidosEnPreparacion.length}
          </span>
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled
                ? 'bg-success-100 text-success-600 hover:bg-success-200'
                : 'bg-surface-hover text-text-tertiary hover:bg-border-default'
            }`}
            title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
            aria-label={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
          >
            {soundEnabled ? (
              <SpeakerWaveIcon className="w-5 h-5" />
            ) : (
              <SpeakerXMarkIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="text-center py-16">
          <ClockIcon className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
          <p className="text-xl text-text-secondary">No hay pedidos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className={`card ${
                pedido.estado === 'PENDIENTE'
                  ? 'border border-warning-200 bg-warning-50/50'
                  : 'border border-info-200 bg-info-50/50'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">#{pedido.id}</h3>
                  <p className="text-sm text-text-secondary">
                    {pedido.tipo === 'MESA'
                      ? `Mesa ${pedido.mesa?.numero}`
                      : pedido.tipo}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`badge ${
                      pedido.estado === 'PENDIENTE'
                        ? 'badge-warning'
                        : 'badge-info'
                    }`}
                  >
                    {pedido.estado === 'PENDIENTE' ? 'PENDIENTE' : 'PREPARANDO'}
                  </span>
                  <p className="text-xs text-text-tertiary mt-1">
                    {getTiempoTranscurrido(pedido.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {pedido.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 bg-surface p-3 rounded-xl"
                  >
                    <span className="text-2xl font-bold text-primary-500">
                      {item.cantidad}x
                    </span>
                    <div>
                      <p className="font-medium text-text-primary">
                        {item.producto?.nombre}
                      </p>
                      {item.modificadores?.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {item.modificadores.map((mod) => (
                            <p
                              key={mod.id}
                              className={`text-sm font-medium ${
                                mod.modificador?.tipo === 'EXCLUSION'
                                  ? 'text-error-600'
                                  : 'text-success-600'
                              }`}
                            >
                              {mod.modificador?.tipo === 'EXCLUSION' ? '- Sin' : '+ Extra'}{' '}
                              {mod.modificador?.nombre}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.observaciones && (
                        <p className="text-sm text-warning-600 font-medium mt-1">
                          Nota: {item.observaciones}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pedido.observaciones && (
                <div className="mb-4 p-2 bg-error-100 rounded-lg text-sm text-error-700">
                  <strong>Nota:</strong> {pedido.observaciones}
                </div>
              )}

              <div className="flex gap-2">
                {pedido.estado === 'PENDIENTE' ? (
                  <button
                    onClick={() => cambiarEstado(pedido.id, 'EN_PREPARACION')}
                    className="btn btn-primary flex-1 py-3"
                  >
                    Iniciar Preparación
                  </button>
                ) : (
                  <button
                    onClick={() => cambiarEstado(pedido.id, 'LISTO')}
                    className="btn btn-success flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    <CheckIcon className="w-5 h-5" />
                    Marcar Listo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
