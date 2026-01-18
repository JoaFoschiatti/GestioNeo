import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { CheckIcon, ClockIcon } from '@heroicons/react/24/outline'

export default function Cocina() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarPedidos()
    // Actualizar cada 10 segundos
    const interval = setInterval(cargarPedidos, 10000)
    return () => clearInterval(interval)
  }, [])

  const cargarPedidos = async () => {
    try {
      const response = await api.get('/pedidos/cocina')
      setPedidos(response.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado: nuevoEstado })
      toast.success(nuevoEstado === 'EN_PREPARACION' ? 'Iniciando preparación' : 'Pedido listo!')
      cargarPedidos()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const getTiempoTranscurrido = (fecha) => {
    const minutos = Math.floor((Date.now() - new Date(fecha)) / 60000)
    if (minutos < 60) return `${minutos} min`
    return `${Math.floor(minutos / 60)}h ${minutos % 60}m`
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const pedidosPendientes = pedidos.filter((p) => p.estado === 'PENDIENTE')
  const pedidosEnPreparacion = pedidos.filter((p) => p.estado === 'EN_PREPARACION')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cocina</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
            Pendientes: {pedidosPendientes.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
            En preparación: {pedidosEnPreparacion.length}
          </span>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="text-center py-16">
          <ClockIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl text-gray-500">No hay pedidos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className={`card ${
                pedido.estado === 'PENDIENTE'
                  ? 'border-2 border-yellow-400 bg-yellow-50'
                  : 'border-2 border-blue-400 bg-blue-50'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">#{pedido.id}</h3>
                  <p className="text-sm text-gray-600">
                    {pedido.tipo === 'MESA'
                      ? `Mesa ${pedido.mesa?.numero}`
                      : pedido.tipo}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      pedido.estado === 'PENDIENTE'
                        ? 'bg-yellow-200 text-yellow-800'
                        : 'bg-blue-200 text-blue-800'
                    }`}
                  >
                    {pedido.estado === 'PENDIENTE' ? 'PENDIENTE' : 'PREPARANDO'}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {getTiempoTranscurrido(pedido.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {pedido.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 bg-white p-3 rounded-lg"
                  >
                    <span className="text-2xl font-bold text-primary-500">
                      {item.cantidad}x
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.producto?.nombre}
                      </p>
                      {item.observaciones && (
                        <p className="text-sm text-red-600 font-medium">
                          {item.observaciones}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pedido.observaciones && (
                <div className="mb-4 p-2 bg-red-100 rounded text-sm text-red-700">
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
