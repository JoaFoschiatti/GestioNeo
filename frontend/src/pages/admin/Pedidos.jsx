import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { EyeIcon, PrinterIcon, CurrencyDollarIcon, PlusIcon } from '@heroicons/react/24/outline'
import useEventSource from '../../hooks/useEventSource'
import NuevoPedidoModal from '../../components/pedidos/NuevoPedidoModal'
import useAsync from '../../hooks/useAsync'

const estadoBadges = {
  PENDIENTE: 'badge-warning',
  EN_PREPARACION: 'badge-info',
  LISTO: 'badge-success',
  ENTREGADO: 'badge-info',
  COBRADO: 'badge-success',
  CANCELADO: 'badge-error'
}

export default function Pedidos() {
  const { usuario } = useAuth()
  const esSoloMozo = usuario?.rol === 'MOZO'
  const puedeCrearPedido = ['ADMIN', 'CAJERO'].includes(usuario?.rol)

  const [pedidos, setPedidos] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState({ monto: '', metodo: 'EFECTIVO', referencia: '' })
  const [showNuevoPedidoModal, setShowNuevoPedidoModal] = useState(false)

  const cargarPedidos = useCallback(async () => {
    const params = filtroEstado ? `?estado=${filtroEstado}` : ''
    const response = await api.get(`/pedidos${params}`)
    setPedidos(response.data)
    return response.data
  }, [filtroEstado])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarPedidosRequest = useCallback(async (_ctx) => (
    cargarPedidos()
  ), [cargarPedidos])

  const { loading, execute: cargarPedidosAsync } = useAsync(
    cargarPedidosRequest,
    { immediate: false, onError: handleLoadError }
  )

  // Cargar pedidos cuando cambia el filtro
  useEffect(() => {
    cargarPedidosAsync()
      .catch(() => {})
  }, [cargarPedidosAsync])

  const handleSseUpdate = useCallback((event) => {
    console.log('[SSE] Evento recibido:', event.type)
    cargarPedidosAsync()
      .catch(() => {})
  }, [cargarPedidosAsync])

  const handleSseError = useCallback((err) => {
    console.error('[SSE] Error en conexión:', err)
  }, [])

  const handleSseOpen = useCallback(() => {
    console.log('[SSE] Conexión establecida')
  }, [])

  useEventSource({
    events: {
      'pedido.updated': handleSseUpdate,
      'pago.updated': handleSseUpdate,
      'impresion.updated': handleSseUpdate
    },
    onError: handleSseError,
    onOpen: handleSseOpen
  })

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
      cargarPedidosAsync()
        .catch(() => {})
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
      cargarPedidosAsync()
        .catch(() => {})
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const imprimirComanda = async (id) => {
    try {
      await api.post(`/impresion/comanda/${id}/reimprimir`, {})
      toast.success('Reimpresion encolada')
      const preview = await api.get(`/impresion/comanda/${id}/preview?tipo=CAJA`)
      const win = window.open('', '_blank')
      if (!win) {
        toast.error('No se pudo abrir la vista previa')
        return
      }
      win.document.write(`<pre style="font-family: monospace; font-size: 14px;">${preview.data}</pre>`)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const renderImpresion = (impresion) => {
    if (!impresion) {
      return <span className="text-xs text-text-tertiary">-</span>
    }

    const label = impresion.status === 'OK'
      ? `OK ${impresion.ok}/${impresion.total}`
      : impresion.status === 'ERROR'
        ? `ERR ${impresion.ok}/${impresion.total}`
        : `${impresion.ok}/${impresion.total}`

    const badgeClass = impresion.status === 'OK'
      ? 'badge-success'
      : impresion.status === 'ERROR'
        ? 'badge-error'
        : 'badge-warning'

    return (
      <span title={impresion.lastError || ''} className={`badge ${badgeClass}`}>
        {label}
      </span>
    )
  }

  const getTipoBadge = (tipo) => {
    switch (tipo) {
      case 'DELIVERY': return 'badge-info'
      case 'MOSTRADOR': return 'badge-warning'
      case 'ONLINE': return 'badge-success'
      default: return 'badge-info'
    }
  }

  if (loading && pedidos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Pedidos</h1>
        <div className="flex items-center gap-4">
          <label className="sr-only" htmlFor="pedidos-filtro-estado">Filtrar por estado</label>
          <select
            id="pedidos-filtro-estado"
            className="input w-48"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PREPARACION">En preparacion</option>
            <option value="LISTO">Listo</option>
            <option value="ENTREGADO">Entregado</option>
            <option value="COBRADO">Cobrado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          {puedeCrearPedido && (
            <button
              onClick={() => setShowNuevoPedidoModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Nuevo Pedido
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tipo</th>
              <th>Mesa/Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Impresion</th>
              <th>Hora</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido) => (
              <tr key={pedido.id}>
                <td className="font-medium text-text-primary">#{pedido.id}</td>
                <td>
                  <span className={`badge ${getTipoBadge(pedido.tipo)}`}>
                    {pedido.tipo}
                  </span>
                </td>
                <td className="text-text-secondary">
                  {pedido.tipo === 'MESA'
                    ? `Mesa ${pedido.mesa?.numero}`
                    : pedido.tipo === 'MOSTRADOR'
                      ? pedido.clienteNombre || 'Mostrador'
                      : pedido.clienteNombre || 'Sin nombre'}
                </td>
                <td className="font-medium text-text-primary">
                  ${parseFloat(pedido.total).toLocaleString('es-AR')}
                </td>
                <td>
                  <span className={`badge ${estadoBadges[pedido.estado]}`}>
                    {pedido.estado.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  {renderImpresion(pedido.impresion)}
                </td>
                <td className="text-text-tertiary">
                  {new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="text-right space-x-2">
                  <button
                    onClick={() => verDetalle(pedido.id)}
                    type="button"
                    aria-label={`Ver detalle del pedido #${pedido.id}`}
                    className="text-primary-500 hover:text-primary-600 transition-colors"
                  >
                    <EyeIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => imprimirComanda(pedido.id)}
                    type="button"
                    aria-label={`Reimprimir comanda del pedido #${pedido.id}`}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <PrinterIcon className="w-5 h-5" />
                  </button>
                  {pedido.estado !== 'COBRADO' && pedido.estado !== 'CANCELADO' && !esSoloMozo && (
                    <button
                      onClick={() => abrirPago(pedido)}
                      type="button"
                      aria-label={`Registrar pago del pedido #${pedido.id}`}
                      className="text-success-500 hover:text-success-600 transition-colors"
                    >
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
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-heading-3">Pedido #{pedidoSeleccionado.id}</h2>
              <span className={`badge ${estadoBadges[pedidoSeleccionado.estado]}`}>
                {pedidoSeleccionado.estado.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="text-sm text-text-secondary">
                <p><strong className="text-text-primary">Tipo:</strong> {pedidoSeleccionado.tipo}</p>
                {pedidoSeleccionado.mesa && <p><strong className="text-text-primary">Mesa:</strong> {pedidoSeleccionado.mesa.numero}</p>}
                {pedidoSeleccionado.clienteNombre && <p><strong className="text-text-primary">Cliente:</strong> {pedidoSeleccionado.clienteNombre}</p>}
                <p><strong className="text-text-primary">Mozo:</strong> {pedidoSeleccionado.usuario?.nombre}</p>
              </div>

              <div>
                <h3 className="font-semibold text-text-primary mb-2">Items:</h3>
                <div className="space-y-2">
                  {pedidoSeleccionado.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-text-primary">
                        {item.cantidad}x {item.producto?.nombre}
                        {item.observaciones && <span className="text-text-tertiary ml-1">({item.observaciones})</span>}
                      </span>
                      <span className="text-text-primary">${parseFloat(item.subtotal).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border-default pt-3">
                <div className="flex justify-between font-bold text-lg text-text-primary">
                  <span>Total:</span>
                  <span>${parseFloat(pedidoSeleccionado.total).toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Cambiar estado */}
              {!['COBRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && (
                <div className="border-t border-border-default pt-3">
                  <p className="text-sm font-medium text-text-primary mb-2">Cambiar estado:</p>
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
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">Registrar Pago</h2>
            <form onSubmit={registrarPago} className="space-y-4">
              <div>
                <label className="label" htmlFor="pago-monto">Monto ($)</label>
                <input
                  id="pago-monto"
                  type="number"
                  step="0.01"
                  className="input"
                  value={pagoForm.monto}
                  onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="pago-metodo">Metodo de Pago</label>
                <select
                  id="pago-metodo"
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
                  <label className="label" htmlFor="pago-referencia">Referencia</label>
                  <input
                    id="pago-referencia"
                    type="text"
                    className="input"
                    value={pagoForm.referencia}
                    onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                    placeholder="Numero de transaccion"
                  />
                </div>
              )}
              <div className="modal-footer">
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

      {/* Modal Nuevo Pedido */}
      <NuevoPedidoModal
        isOpen={showNuevoPedidoModal}
        onClose={() => setShowNuevoPedidoModal(false)}
        onSuccess={() => {
          setShowNuevoPedidoModal(false)
          cargarPedidos()
        }}
      />
    </div>
  )
}
