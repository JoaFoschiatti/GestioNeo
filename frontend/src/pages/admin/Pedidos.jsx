import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { EyeIcon, PrinterIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'

const estadoColors = {
  PENDIENTE: 'bg-yellow-100 text-yellow-700',
  EN_PREPARACION: 'bg-blue-100 text-blue-700',
  LISTO: 'bg-green-100 text-green-700',
  ENTREGADO: 'bg-purple-100 text-purple-700',
  COBRADO: 'bg-gray-100 text-gray-700',
  CANCELADO: 'bg-red-100 text-red-700'
}

export default function Pedidos() {
  const { usuario } = useAuth()
  const esSoloMozo = usuario?.rol === 'MOZO'

  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState({ monto: '', metodo: 'EFECTIVO', referencia: '' })

  useEffect(() => {
    cargarPedidos()
  }, [filtroEstado])

  const cargarPedidos = async () => {
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : ''
      const response = await api.get(`/pedidos${params}`)
      setPedidos(response.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const verDetalle = async (id) => {
    try {
      const response = await api.get(`/pedidos/${id}`)
      setPedidoSeleccionado(response.data)
      setShowModal(true)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado: nuevoEstado })
      toast.success(`Estado cambiado a ${nuevoEstado}`)
      cargarPedidos()
      if (pedidoSeleccionado?.id === id) {
        verDetalle(id)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const abrirPago = (pedido) => {
    setPedidoSeleccionado(pedido)
    const totalPagado = pedido.pagos?.reduce((sum, p) => sum + parseFloat(p.monto), 0) || 0
    const pendiente = parseFloat(pedido.total) - totalPagado
    setPagoForm({ monto: pendiente.toFixed(2), metodo: 'EFECTIVO', referencia: '' })
    setShowPagoModal(true)
  }

  const registrarPago = async (e) => {
    e.preventDefault()
    try {
      await api.post('/pagos', {
        pedidoId: pedidoSeleccionado.id,
        monto: parseFloat(pagoForm.monto),
        metodo: pagoForm.metodo,
        referencia: pagoForm.referencia || null
      })
      toast.success('Pago registrado')
      setShowPagoModal(false)
      cargarPedidos()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const imprimirComanda = async (id) => {
    try {
      const response = await api.post(`/impresion/comanda/${id}`)
      toast.success('Comanda enviada a imprimir')
      // Mostrar preview en nueva ventana
      const preview = response.data.comandas.cocina
      const win = window.open('', '_blank')
      win.document.write(`<pre style="font-family: monospace; font-size: 14px;">${preview}</pre>`)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <select
          className="input w-48"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_PREPARACION">En preparación</option>
          <option value="LISTO">Listo</option>
          <option value="ENTREGADO">Entregado</option>
          <option value="COBRADO">Cobrado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesa/Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pedidos.map((pedido) => (
              <tr key={pedido.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">#{pedido.id}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    pedido.tipo === 'DELIVERY' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {pedido.tipo}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {pedido.tipo === 'MESA'
                    ? `Mesa ${pedido.mesa?.numero}`
                    : pedido.clienteNombre || 'Sin nombre'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  ${parseFloat(pedido.total).toLocaleString('es-AR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${estadoColors[pedido.estado]}`}>
                    {pedido.estado.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <button onClick={() => verDetalle(pedido.id)} className="text-primary-600 hover:text-primary-800">
                    <EyeIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => imprimirComanda(pedido.id)} className="text-gray-600 hover:text-gray-800">
                    <PrinterIcon className="w-5 h-5" />
                  </button>
                  {pedido.estado !== 'COBRADO' && pedido.estado !== 'CANCELADO' && !esSoloMozo && (
                    <button onClick={() => abrirPago(pedido)} className="text-green-600 hover:text-green-800">
                      <CurrencyDollarIcon className="w-5 h-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Detalle */}
      {showModal && pedidoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Pedido #{pedidoSeleccionado.id}</h2>
              <span className={`px-2 py-1 text-xs rounded-full ${estadoColors[pedidoSeleccionado.estado]}`}>
                {pedidoSeleccionado.estado.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p><strong>Tipo:</strong> {pedidoSeleccionado.tipo}</p>
                {pedidoSeleccionado.mesa && <p><strong>Mesa:</strong> {pedidoSeleccionado.mesa.numero}</p>}
                {pedidoSeleccionado.clienteNombre && <p><strong>Cliente:</strong> {pedidoSeleccionado.clienteNombre}</p>}
                <p><strong>Mozo:</strong> {pedidoSeleccionado.usuario?.nombre}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Items:</h3>
                <div className="space-y-2">
                  {pedidoSeleccionado.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.cantidad}x {item.producto?.nombre}
                        {item.observaciones && <span className="text-gray-500 ml-1">({item.observaciones})</span>}
                      </span>
                      <span>${parseFloat(item.subtotal).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>${parseFloat(pedidoSeleccionado.total).toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Cambiar estado */}
              {!['COBRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Cambiar estado:</p>
                  <div className="flex flex-wrap gap-2">
                    {!esSoloMozo && pedidoSeleccionado.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'EN_PREPARACION')}
                        className="btn btn-primary text-sm"
                      >
                        Iniciar preparacion
                      </button>
                    )}
                    {!esSoloMozo && pedidoSeleccionado.estado === 'EN_PREPARACION' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'LISTO')}
                        className="btn btn-success text-sm"
                      >
                        Marcar listo
                      </button>
                    )}
                    {pedidoSeleccionado.estado === 'LISTO' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'ENTREGADO')}
                        className="btn btn-primary text-sm"
                      >
                        Marcar entregado
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setShowModal(false)} className="btn btn-secondary w-full mt-6">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Pago */}
      {showPagoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Registrar Pago</h2>
            <form onSubmit={registrarPago} className="space-y-4">
              <div>
                <label className="label">Monto ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={pagoForm.monto}
                  onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Método de Pago</label>
                <select
                  className="input"
                  value={pagoForm.metodo}
                  onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="MERCADOPAGO">MercadoPago</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </div>
              {pagoForm.metodo !== 'EFECTIVO' && (
                <div>
                  <label className="label">Referencia</label>
                  <input
                    type="text"
                    className="input"
                    value={pagoForm.referencia}
                    onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                    placeholder="Número de transacción"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPagoModal(false)} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success flex-1">
                  Registrar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
