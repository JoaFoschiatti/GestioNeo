import { useState, useCallback } from 'react'
import api from '../../services/api'
import {
  TruckIcon,
  PhoneIcon,
  MapPinIcon,
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import usePolling from '../../hooks/usePolling'
import useEventSource from '../../hooks/useEventSource'
import useAsync from '../../hooks/useAsync'

const estadoBadge = {
  PENDIENTE: 'badge-warning',
  EN_PREPARACION: 'badge-info',
  LISTO: 'badge-success'
}

const estadoLabel = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En Preparacion',
  LISTO: 'Listo para entregar'
}

export default function DeliveryPedidos() {
  const [pedidos, setPedidos] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [actualizando, setActualizando] = useState(null)

  const cargarPedidos = useCallback(async () => {
    const response = await api.get('/pedidos/delivery', { skipToast: true })
    const pedidosOrdenados = [...response.data].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    setPedidos(pedidosOrdenados)
    setLoadError(null)
    return pedidosOrdenados
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error al cargar pedidos:', error)
    setLoadError('No pudimos cargar los pedidos.')
  }, [])

  const cargarPedidosRequest = useCallback(async (_ctx) => (
    cargarPedidos()
  ), [cargarPedidos])

  const { loading, execute: cargarPedidosAsync } = useAsync(
    cargarPedidosRequest,
    { onError: handleLoadError }
  )

  usePolling(cargarPedidosAsync, 30000, { immediate: false })

  useEventSource({
    events: {
      'pedido.updated': cargarPedidosAsync
    }
  })

  const marcarEntregado = async (pedidoId) => {
    setActualizando(pedidoId)
    try {
      await api.patch(
        `/pedidos/${pedidoId}/estado`,
        { estado: 'ENTREGADO' },
        { skipToast: true }
      )
      toast.success('Pedido entregado')
      setPedidos(prev => prev.filter(p => p.id !== pedidoId))
    } catch (error) {
      console.error('Error al actualizar pedido:', error)
      toast.error('Error al marcar como entregado')
    } finally {
      setActualizando(null)
    }
  }

  if (loading && pedidos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (loadError && pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ExclamationCircleIcon className="w-10 h-10 text-error-500 mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No pudimos cargar los pedidos</h2>
        <p className="text-sm text-text-secondary mb-4">{loadError}</p>
        <button type="button" onClick={cargarPedidosAsync} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    )
  }

  const getTiempoMinutos = (fecha) => Math.max(0, Math.floor((Date.now() - new Date(fecha)) / 60000))

  const getSlaEstado = (minutos) => {
    if (minutos >= 40) return 'CRITICO'
    if (minutos >= 20) return 'ATENCION'
    return 'OK'
  }

  const getSlaBadgeClass = (sla) => {
    if (sla === 'CRITICO') return 'badge-error'
    if (sla === 'ATENCION') return 'badge-warning'
    return 'badge-success'
  }

  return (
    <div>
      {loadError && pedidos.length > 0 && (
        <div className="mb-4 bg-error-50 text-error-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{loadError}</span>
          <button
            type="button"
            onClick={cargarPedidosAsync}
            className="text-sm font-medium hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-1">Mis Entregas</h1>
          <p className="text-text-secondary">Pedidos delivery pendientes de entrega</p>
        </div>
        <button
          onClick={cargarPedidosAsync}
          className="btn btn-secondary"
        >
          Actualizar
        </button>
      </div>

      {pedidos.length === 0 ? (
        <div className="card text-center py-12">
          <TruckIcon className="w-16 h-16 mx-auto text-text-tertiary mb-4" />
          <p className="text-text-secondary text-lg">No hay pedidos delivery pendientes</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="card"
              data-testid={`delivery-order-card-${pedido.id}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-text-primary">
                  Pedido #{pedido.id}
                </span>
                <span className={`badge ${estadoBadge[pedido.estado]}`}>
                  {estadoLabel[pedido.estado]}
                </span>
              </div>

              <div className="mb-3">
                <span className={`badge ${getSlaBadgeClass(getSlaEstado(getTiempoMinutos(pedido.createdAt)))}`}>
                  SLA {getSlaEstado(getTiempoMinutos(pedido.createdAt))}
                </span>
              </div>

              {/* Datos del cliente */}
              <div className="space-y-2 mb-4 p-3 bg-surface-hover rounded-xl">
                {pedido.clienteNombre && (
                  <div className="flex items-center gap-2 text-text-primary">
                    <UserIcon className="w-4 h-4 text-text-tertiary" />
                    <span className="font-medium">{pedido.clienteNombre}</span>
                  </div>
                )}
                {pedido.clienteTelefono && (
                  <div className="flex items-center gap-2 text-text-primary">
                    <PhoneIcon className="w-4 h-4 text-text-tertiary" />
                    <a href={`tel:${pedido.clienteTelefono}`} className="text-primary-600 hover:underline">
                      {pedido.clienteTelefono}
                    </a>
                  </div>
                )}
                {pedido.clienteDireccion && (
                  <div className="flex items-start gap-2 text-text-primary">
                    <MapPinIcon className="w-4 h-4 text-text-tertiary mt-0.5" />
                    <span>{pedido.clienteDireccion}</span>
                  </div>
                )}
              </div>

              {/* Items del pedido */}
              <div className="border-t border-border-default pt-3 mb-4">
                <p className="text-sm font-medium text-text-tertiary mb-2">Productos:</p>
                <ul className="space-y-1">
                  {pedido.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between text-sm text-text-secondary">
                      <span>
                        {item.cantidad}x {item.producto.nombre}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Total y hora */}
              <div className="flex items-center justify-between text-sm text-text-tertiary mb-4">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <span className="font-bold text-text-primary text-lg">
                  ${parseFloat(pedido.total).toLocaleString('es-AR')}
                </span>
              </div>

              {/* Observaciones */}
              {pedido.observaciones && (
                <div className="text-sm text-text-secondary bg-warning-50 p-2 rounded-lg mb-4">
                  <strong>Nota:</strong> {pedido.observaciones}
                </div>
              )}

              {/* Boton entregar */}
              {pedido.estado === 'LISTO' && (
                <button
                  onClick={() => marcarEntregado(pedido.id)}
                  disabled={actualizando === pedido.id}
                  className="btn btn-success w-full flex items-center justify-center gap-2"
                  data-testid={`delivery-mark-delivered-${pedido.id}`}
                >
                  {actualizando === pedido.id ? (
                    <div className="spinner" />
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      Marcar como Entregado
                    </>
                  )}
                </button>
              )}

              {pedido.estado !== 'LISTO' && (
                <div className="text-center text-sm text-text-tertiary py-2">
                  Esperando que cocina marque como listo...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
