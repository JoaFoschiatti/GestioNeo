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

const estadoColor = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  EN_PREPARACION: 'bg-blue-100 text-blue-800',
  LISTO: 'bg-green-100 text-green-800'
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
    setPedidos(response.data)
    setLoadError(null)
    return response.data
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (loadError && pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ExclamationCircleIcon className="w-10 h-10 text-red-500 mb-3" />
        <h2 className="text-lg font-semibold text-gray-900">No pudimos cargar los pedidos</h2>
        <p className="text-sm text-gray-600 mb-4">{loadError}</p>
        <button type="button" onClick={cargarPedidosAsync} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      {loadError && pedidos.length > 0 && (
        <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
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
          <h1 className="text-2xl font-bold text-gray-900">Mis Entregas</h1>
          <p className="text-gray-500">Pedidos delivery pendientes de entrega</p>
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
          <TruckIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No hay pedidos delivery pendientes</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pedidos.map((pedido) => (
            <div key={pedido.id} className="card">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-gray-900">
                  Pedido #{pedido.id}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColor[pedido.estado]}`}>
                  {estadoLabel[pedido.estado]}
                </span>
              </div>

              {/* Datos del cliente */}
              <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
                {pedido.clienteNombre && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{pedido.clienteNombre}</span>
                  </div>
                )}
                {pedido.clienteTelefono && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <PhoneIcon className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${pedido.clienteTelefono}`} className="text-primary-600 hover:underline">
                      {pedido.clienteTelefono}
                    </a>
                  </div>
                )}
                {pedido.clienteDireccion && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span>{pedido.clienteDireccion}</span>
                  </div>
                )}
              </div>

              {/* Items del pedido */}
              <div className="border-t pt-3 mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Productos:</p>
                <ul className="space-y-1">
                  {pedido.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between text-sm">
                      <span>
                        {item.cantidad}x {item.producto.nombre}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Total y hora */}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <span className="font-bold text-gray-900 text-lg">
                  ${parseFloat(pedido.total).toLocaleString('es-AR')}
                </span>
              </div>

              {/* Observaciones */}
              {pedido.observaciones && (
                <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded mb-4">
                  <strong>Nota:</strong> {pedido.observaciones}
                </div>
              )}

              {/* Boton entregar */}
              {pedido.estado === 'LISTO' && (
                <button
                  onClick={() => marcarEntregado(pedido.id)}
                  disabled={actualizando === pedido.id}
                  className="btn btn-success w-full flex items-center justify-center gap-2"
                >
                  {actualizando === pedido.id ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      Marcar como Entregado
                    </>
                  )}
                </button>
              )}

              {pedido.estado !== 'LISTO' && (
                <div className="text-center text-sm text-gray-500 py-2">
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
