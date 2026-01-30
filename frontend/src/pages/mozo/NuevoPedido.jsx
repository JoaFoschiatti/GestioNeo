import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, MinusIcon, TrashIcon, PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline'
import usePedidoConModificadores from '../../hooks/usePedidoConModificadores'
import useAsync from '../../hooks/useAsync'

export default function NuevoPedido() {
  const { mesaId } = useParams()
  const navigate = useNavigate()
  const [mesa, setMesa] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [tipo, setTipo] = useState(mesaId ? 'MESA' : 'DELIVERY')
  const [clienteData, setClienteData] = useState({ nombre: '', telefono: '', direccion: '' })
  const [observaciones, setObservaciones] = useState('')
  const [enviando, setEnviando] = useState(false)
  const {
    carrito,
    showModModal,
    productoSeleccionado,
    modificadoresProducto,
    modificadoresSeleccionados,
    handleClickProducto,
    toggleModificador,
    confirmarProductoConModificadores,
    agregarAlCarrito,
    actualizarCantidad,
    eliminarDelCarrito,
    actualizarObservacionItem,
    closeModModal
  } = usePedidoConModificadores()

  const cargarDatos = useCallback(async () => {
    const catRes = await api.get('/categorias/publicas', { skipToast: true })
    setCategorias(catRes.data)
    if (catRes.data.length > 0) {
      setCategoriaActiva(catRes.data[0].id)
    }

    if (mesaId) {
      const mesaRes = await api.get(`/mesas/${mesaId}`, { skipToast: true })
      setMesa(mesaRes.data)
    }
    return { categorias: catRes.data }
  }, [mesaId])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    if (error.response?.status !== 401) {
      toast.error(error.response?.data?.error?.message || 'Error al cargar datos')
    }
  }, [])

  const cargarDatosRequest = useCallback(async (_ctx) => (
    cargarDatos()
  ), [cargarDatos])

  const { loading } = useAsync(cargarDatosRequest, { onError: handleLoadError })

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0)
  }

  const enviarPedido = async () => {
    if (carrito.length === 0) {
      toast.error('Agrega productos al pedido')
      return
    }

    if (tipo === 'DELIVERY' && !clienteData.nombre) {
      toast.error('Ingresa el nombre del cliente')
      return
    }

    setEnviando(true)
    try {
      const pedidoData = {
        tipo,
        mesaId: tipo === 'MESA' ? parseInt(mesaId) : null,
        items: carrito.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          observaciones: item.observaciones || undefined,
          modificadores: item.modificadores.map(m => m.id)
        })),
        observaciones: observaciones || undefined,
        ...(tipo === 'DELIVERY' && {
          clienteNombre: clienteData.nombre || undefined,
          clienteTelefono: clienteData.telefono || undefined,
          clienteDireccion: clienteData.direccion || undefined
        })
      }

      const response = await api.post('/pedidos', pedidoData, { skipToast: true })
      toast.success(`Pedido #${response.data.id} creado! Se imprimira al iniciar preparacion.`)

      navigate(tipo === 'MESA' ? '/mozo/mesas' : '/pedidos')
    } catch (error) {
      console.error('Error:', error)
      if (error.response?.status !== 401) {
        toast.error(error.response?.data?.error?.message || 'Error al crear pedido')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (loading && categorias.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  const productosFiltrados = categorias.find(c => c.id === categoriaActiva)?.productos || []

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Panel izquierdo: Productos */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-heading-2">
            {tipo === 'MESA' ? `Nuevo Pedido - Mesa ${mesa?.numero}` : 'Nuevo Pedido'}
          </h1>
          {!mesaId && (
            <>
              <label className="sr-only" htmlFor="pedido-tipo-mozo">Tipo de pedido</label>
              <select
                id="pedido-tipo-mozo"
                className="input w-40"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
              <option value="DELIVERY">Delivery</option>
              <option value="MOSTRADOR">Mostrador</option>
              </select>
            </>
          )}
        </div>

        {/* Categorías */}
        <div className="tabs mb-4 overflow-x-auto pb-2">
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={`tab whitespace-nowrap ${categoriaActiva === cat.id ? 'tab-active' : ''}`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Productos */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {productosFiltrados.map((producto) => (
              <button
                key={producto.id}
                onClick={() => handleClickProducto(producto)}
                disabled={!producto.disponible}
                className={`p-4 bg-surface rounded-xl border border-border-default text-left transition-all ${
                  producto.disponible
                    ? 'hover:shadow-card hover:-translate-y-0.5'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <h3 className="font-medium text-text-primary mb-1">{producto.nombre}</h3>
                <p className="text-sm text-text-tertiary line-clamp-2 mb-2">{producto.descripcion}</p>
                <p className="text-primary-600 font-bold">
                  ${parseFloat(producto.precio).toLocaleString('es-AR')}
                </p>
                {!producto.disponible && (
                  <span className="text-xs text-error-500 font-medium">No disponible</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho: Carrito */}
      <div className="w-full lg:w-96 bg-surface rounded-2xl shadow-card border border-border-default p-4 flex flex-col">
        <h2 className="text-heading-3 mb-4">Pedido</h2>

        {/* Datos cliente (delivery) */}
        {tipo === 'DELIVERY' && (
          <div className="space-y-3 mb-4 pb-4 border-b">
            <label className="sr-only" htmlFor="pedido-cliente-nombre">Nombre del cliente</label>
            <input
              id="pedido-cliente-nombre"
              type="text"
              className="input"
              placeholder="Nombre del cliente *"
              value={clienteData.nombre}
              onChange={(e) => setClienteData({ ...clienteData, nombre: e.target.value })}
            />
            <label className="sr-only" htmlFor="pedido-cliente-telefono">Telefono</label>
            <input
              id="pedido-cliente-telefono"
              type="text"
              className="input"
              placeholder="Telefono"
              value={clienteData.telefono}
              onChange={(e) => setClienteData({ ...clienteData, telefono: e.target.value })}
            />
            <label className="sr-only" htmlFor="pedido-cliente-direccion">Direccion de entrega</label>
            <input
              id="pedido-cliente-direccion"
              type="text"
              className="input"
              placeholder="Direccion de entrega"
              value={clienteData.direccion}
              onChange={(e) => setClienteData({ ...clienteData, direccion: e.target.value })}
            />
          </div>
        )}

        {/* Items del carrito */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {carrito.length === 0 ? (
            <p className="text-text-tertiary text-center py-8">Agrega productos al pedido</p>
          ) : (
            carrito.map((item) => (
              <div key={item.itemId} className="bg-surface-hover rounded-xl p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-text-primary">{item.nombre}</h4>
                    {item.modificadores.length > 0 && (
                      <div className="mt-1">
                        {item.modificadores.map(mod => (
                          <span
                            key={mod.id}
                            className={`text-xs mr-2 ${
                              mod.tipo === 'EXCLUSION' ? 'text-error-600' : 'text-success-600'
                            }`}
                          >
                            {mod.tipo === 'EXCLUSION' ? `- Sin ${mod.nombre}` : `+ Extra ${mod.nombre}`}
                            {parseFloat(mod.precio) > 0 && ` (+$${parseFloat(mod.precio).toFixed(0)})`}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-text-tertiary">
                      ${parseFloat(item.precio).toLocaleString('es-AR')} c/u
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarDelCarrito(item.itemId)}
                    type="button"
                    aria-label={`Eliminar ${item.nombre} del carrito`}
                    className="text-error-500 hover:text-error-700"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => actualizarCantidad(item.itemId, -1)}
                      type="button"
                      aria-label={`Reducir cantidad de ${item.nombre}`}
                      className="p-1 bg-surface rounded hover:bg-border-default"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium text-text-primary">{item.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(item.itemId, 1)}
                      type="button"
                      aria-label={`Aumentar cantidad de ${item.nombre}`}
                      className="p-1 bg-surface rounded hover:bg-border-default"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="font-medium text-text-primary">
                    ${(parseFloat(item.precio) * item.cantidad).toLocaleString('es-AR')}
                  </span>
                </div>
                <input
                  type="text"
                  className="input mt-2 text-sm"
                  placeholder="Observaciones adicionales"
                  value={item.observaciones}
                  onChange={(e) => actualizarObservacionItem(item.itemId, e.target.value)}
                />
              </div>
            ))
          )}
        </div>

        {/* Observaciones generales */}
        <div className="mt-4 pt-4 border-t">
          <label htmlFor="pedido-observaciones" className="sr-only">Observaciones del pedido</label>
          <textarea
            id="pedido-observaciones"
            className="input text-sm"
            placeholder="Observaciones del pedido"
            rows="2"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        {/* Total y boton */}
        <div className="mt-4 pt-4 border-t border-border-default">
          <div className="flex justify-between text-xl font-bold mb-4">
            <span className="text-text-primary">Total:</span>
            <span className="text-primary-600">${calcularTotal().toLocaleString('es-AR')}</span>
          </div>
          <button
            onClick={enviarPedido}
            disabled={enviando || carrito.length === 0}
            className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <PrinterIcon className="w-5 h-5" />
            {enviando ? 'Enviando...' : 'Confirmar Pedido'}
          </button>
        </div>
      </div>

      {/* Modal de Modificadores */}
      {showModModal && productoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-heading-3">
                  {productoSeleccionado.nombre}
                </h3>
                <p className="text-primary-600 font-bold">
                  ${parseFloat(productoSeleccionado.precio).toLocaleString('es-AR')}
                </p>
              </div>
              <button
                onClick={closeModModal}
                type="button"
                aria-label="Cerrar modificadores"
                className="text-text-tertiary hover:text-text-primary"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-2 mb-6">
              <p className="text-sm font-medium text-text-secondary">Personaliza tu pedido:</p>
              {modificadoresProducto.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => toggleModificador(mod)}
                  className={`w-full p-3 rounded-xl border text-left transition-colors ${
                    modificadoresSeleccionados.find(m => m.id === mod.id)
                      ? mod.tipo === 'EXCLUSION'
                        ? 'border-error-500 bg-error-50'
                        : 'border-success-500 bg-success-50'
                      : 'border-border-default hover:border-border-subtle'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={
                      modificadoresSeleccionados.find(m => m.id === mod.id)
                        ? mod.tipo === 'EXCLUSION' ? 'text-error-700' : 'text-success-700'
                        : 'text-text-primary'
                    }>
                      {mod.tipo === 'EXCLUSION' ? `Sin ${mod.nombre}` : `Extra ${mod.nombre}`}
                    </span>
                    {parseFloat(mod.precio) > 0 && (
                      <span className="text-success-600 font-medium">
                        +${parseFloat(mod.precio).toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  agregarAlCarrito(productoSeleccionado, [])
                  closeModModal()
                }}
                className="btn btn-secondary flex-1"
              >
                Sin modificar
              </button>
              <button
                onClick={confirmarProductoConModificadores}
                className="btn btn-primary flex-1"
              >
                Agregar
                {modificadoresSeleccionados.length > 0 && (
                  <span className="ml-1">
                    (+$
                    {modificadoresSeleccionados
                      .reduce((sum, m) => sum + parseFloat(m.precio), 0)
                      .toLocaleString('es-AR')}
                    )
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
