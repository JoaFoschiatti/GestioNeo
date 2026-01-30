import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { PlusIcon, CalendarDaysIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'
import usePolling from '../../hooks/usePolling'
import useEventSource from '../../hooks/useEventSource'

export default function MozoMesas() {
  const [mesas, setMesas] = useState([])
  const [reservasProximas, setReservasProximas] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [reservasError, setReservasError] = useState(null)
  const navigate = useNavigate()

  const cargarMesas = useCallback(async () => {
    try {
      const response = await api.get('/mesas?activa=true', { skipToast: true })
      setMesas(response.data)
      setLoadError(null)
    } catch (error) {
      console.error('Error:', error)
      setLoadError('No pudimos cargar las mesas.')
    }
  }, [])

  const cargarReservasProximas = useCallback(async () => {
    try {
      const response = await api.get('/reservas/proximas', { skipToast: true })
      setReservasProximas(response.data)
      setReservasError(null)
    } catch (error) {
      console.error('Error:', error)
      setReservasError('No pudimos cargar las reservas proximas.')
    }
  }, [])

  const refrescar = useCallback(async () => {
    await Promise.all([cargarMesas(), cargarReservasProximas()])
  }, [cargarMesas, cargarReservasProximas])

  const refrescarRequest = useCallback(async (_ctx) => (
    refrescar()
  ), [refrescar])

  const { loading, execute: refrescarAsync } = useAsync(refrescarRequest)

  usePolling(refrescarAsync, 30000, { immediate: false })

  useEventSource({
    events: {
      'pedido.updated': refrescarAsync,
      'mesa.updated': refrescarAsync,
      'reserva.updated': refrescarAsync
    }
  })

  const getReservaProxima = (mesaId) => {
    return reservasProximas.find(r => r.mesaId === mesaId)
  }

  const formatHora = (fecha) => {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstadoStyle = (estado) => {
    switch (estado) {
      case 'LIBRE':
        return 'bg-success-50 border-success-200 hover:bg-success-100'
      case 'OCUPADA':
        return 'bg-error-50 border-error-200 hover:bg-error-100'
      case 'RESERVADA':
        return 'bg-warning-50 border-warning-200 hover:bg-warning-100'
      default:
        return 'bg-surface-hover border-border-subtle'
    }
  }

  const handleMesaClick = (mesa) => {
    if (mesa.estado === 'LIBRE') {
      // Ir a crear nuevo pedido para esta mesa
      navigate(`/mozo/nuevo-pedido/${mesa.id}`)
    } else if (mesa.estado === 'OCUPADA') {
      // Ver pedido actual de la mesa
      if (mesa.pedidos?.[0]) {
        navigate(`/pedidos?mesaId=${mesa.id}`)
      }
    }
  }

  const handleRetry = () => {
    setLoadError(null)
    refrescarAsync()
  }

  if (loading && mesas.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (loadError && mesas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ExclamationCircleIcon className="w-10 h-10 text-error-500 mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No pudimos cargar las mesas</h2>
        <p className="text-sm text-text-secondary mb-4">{loadError}</p>
        <button type="button" onClick={handleRetry} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    )
  }

  // Agrupar mesas por zona
  const mesasPorZona = mesas.reduce((acc, mesa) => {
    const zona = mesa.zona || 'Sin zona'
    if (!acc[zona]) acc[zona] = []
    acc[zona].push(mesa)
    return acc
  }, {})

  return (
    <div>
      {loadError && mesas.length > 0 && (
        <div className="mb-4 bg-error-50 text-error-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{loadError}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm font-medium hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}
      {reservasError && (
        <div className="mb-4 bg-warning-50 text-warning-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{reservasError}</span>
          <button
            type="button"
            onClick={cargarReservasProximas}
            className="text-sm font-medium hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Mesas</h1>
        <button
          onClick={() => navigate('/mozo/nuevo-pedido')}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Pedido Delivery/Mostrador
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mb-6 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-success-100 border border-success-200"></div>
          <span>Libre</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-error-100 border border-error-200"></div>
          <span>Ocupada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-warning-100 border border-warning-200"></div>
          <span>Reservada</span>
        </div>
      </div>

      {Object.entries(mesasPorZona).map(([zona, mesasZona]) => (
        <div key={zona} className="mb-8">
          <h2 className="text-heading-3 text-text-secondary mb-4">{zona}</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mesasZona.map((mesa) => {
              const reservaProxima = getReservaProxima(mesa.id)
              return (
                <button
                  key={mesa.id}
                  onClick={() => handleMesaClick(mesa)}
                  className={`p-4 rounded-xl border transition-all relative ${getEstadoStyle(mesa.estado)}`}
                >
                  {reservaProxima && (
                    <div className="absolute -top-2 -right-2 bg-warning-500 text-white rounded-full p-1" title={`Reserva a las ${formatHora(reservaProxima.fechaHora)} - ${reservaProxima.clienteNombre}`}>
                      <CalendarDaysIcon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="text-3xl font-bold text-text-primary mb-1">
                    {mesa.numero}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {mesa.capacidad} personas
                  </div>
                  {mesa.estado === 'OCUPADA' && mesa.pedidos?.[0] && (
                    <div className="text-xs text-text-tertiary mt-2">
                      Pedido #{mesa.pedidos[0].id}
                    </div>
                  )}
                  {reservaProxima && mesa.estado === 'LIBRE' && (
                    <div className="text-xs text-warning-600 mt-2 font-medium">
                      Reserva {formatHora(reservaProxima.fechaHora)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
