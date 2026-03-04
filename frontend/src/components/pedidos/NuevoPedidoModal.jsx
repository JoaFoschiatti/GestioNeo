import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline'
import usePedidoConModificadores from '../../hooks/usePedidoConModificadores'
import useAsync from '../../hooks/useAsync'

export default function NuevoPedidoModal({ isOpen, onClose, onSuccess }) {
  const [categorias, setCategorias] = useState([])
  const [mesas, setMesas] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [tipo, setTipo] = useState('MOSTRADOR')
  const [mesaId, setMesaId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
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
    resetCarrito,
    closeModModal
  } = usePedidoConModificadores({
    onItemAdded: (producto) => toast.success(`${producto.nombre} agregado`)
  })

  const cargarDatos = useCallback(async () => {
    const [catRes, mesasRes] = await Promise.all([
      api.get('/categorias/publicas', { skipToast: true }),
      api.get('/mesas', { skipToast: true })
    ])
    setCategorias(catRes.data)
    setMesas(mesasRes.data.filter(m => m.estado === 'LIBRE'))
    if (catRes.data.length > 0) {
      setCategoriaActiva(catRes.data[0].id)
    }
    return { categorias: catRes.data }
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    toast.error('Error al cargar datos')
  }, [])

  const cargarDatosRequest = useCallback(async (_ctx) => (
    cargarDatos()
  ), [cargarDatos])

  const { loading, execute: cargarDatosAsync } = useAsync(
    cargarDatosRequest,
    { immediate: false, onError: handleLoadError }
  )

  useEffect(() => {
    if (isOpen) {
      cargarDatosAsync().catch(() => {})
    }
  }, [isOpen, cargarDatosAsync])

  const resetForm = () => {
    resetCarrito()
    setTipo('MOSTRADOR')
    setMesaId('')
    setClienteNombre('')
    setObservaciones('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0)
  }

  const enviarPedido = async () => {
    if (carrito.length === 0) {
      toast.error('Agrega productos al pedido')
      return
    }

    if (tipo === 'MESA' && !mesaId) {
      toast.error('Selecciona una mesa')
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
        clienteNombre: clienteNombre || undefined
      }

      const response = await api.post('/pedidos', pedidoData, { skipToast: true })
      toast.success(`Pedido #${response.data.id} creado!`)
      resetForm()
      onSuccess()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al crear pedido')
    } finally {
      setEnviando(false)
    }
  }

  if (!isOpen) return null

  const productosFiltrados = categorias.find(c => c.id === categoriaActiva)?.productos || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Nuevo Pedido Manual</h2>
          <button
            onClick={handleClose}
            type="button"
            aria-label="Cerrar modal de pedido"
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Panel izquierdo: Productos */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* Tipo y Mesa */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="label" htmlFor="pedido-tipo">Tipo de Pedido</label>
                  <select
                    id="pedido-tipo"
                    className="input"
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value)
                      if (e.target.value !== 'MESA') setMesaId('')
                    }}
                  >
                    <option value="MOSTRADOR">Mostrador</option>
                    <option value="MESA">Mesa</option>
                  </select>
                </div>
                {tipo === 'MESA' && (
                  <div className="flex-1">
                    <label className="label" htmlFor="pedido-mesa">Mesa</label>
                    <select
                      id="pedido-mesa"
                      className="input"
                      value={mesaId}
                      onChange={(e) => setMesaId(e.target.value)}
                    >
                      <option value="">Seleccionar mesa...</option>
                      {mesas.map(mesa => (
                        <option key={mesa.id} value={mesa.id}>
                          Mesa {mesa.numero} {mesa.zona && `(${mesa.zona})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex-1">
                  <label className="label" htmlFor="pedido-cliente">Cliente (opcional)</label>
                  <input
                    id="pedido-cliente"
                    type="text"
                    className="input"
                    placeholder="Nombre del cliente"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                  />
                </div>
              </div>

              {/* Categorias */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {categorias.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoriaActiva(cat.id)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                      categoriaActiva === cat.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat.nombre}
                  </button>
                ))}
              </div>

              {/* Productos */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {productosFiltrados.map((producto) => (
                    <button
                      key={producto.id}
                      onClick={() => handleClickProducto(producto)}
                      disabled={!producto.disponible}
                      className={`p-3 bg-white rounded-lg border text-left transition-shadow ${
                        producto.disponible
                          ? 'hover:shadow-md hover:border-primary-300'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <h3 className="font-medium text-gray-900 text-sm mb-1">{producto.nombre}</h3>
                      <p className="text-primary-600 font-bold text-sm">
                        ${parseFloat(producto.precio).toLocaleString('es-AR')}
                      </p>
                      {!producto.disponible && (
                        <span className="text-xs text-red-500">No disponible</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel derecho: Carrito */}
            <div className="w-80 bg-gray-50 border-l flex flex-col">
              <div className="p-4 border-b bg-white">
                <div className="flex items-center gap-2">
                  <ShoppingCartIcon className="w-5 h-5 text-primary-500" />
                  <h3 className="font-bold text-gray-900">Pedido</h3>
                  {carrito.length > 0 && (
                    <span className="ml-auto bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                      {carrito.reduce((sum, i) => sum + i.cantidad, 0)} items
                    </span>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {carrito.length === 0 ? (
                  <p className="text-gray-400 text-center py-8 text-sm">
                    Selecciona productos para agregar
                  </p>
                ) : (
                  carrito.map((item) => (
                    <div key={item.itemId} className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm truncate">{item.nombre}</h4>
                          {item.modificadores.length > 0 && (
                            <div className="mt-1 space-x-1">
                              {item.modificadores.map(mod => (
                                <span
                                  key={mod.id}
                                  className={`text-xs ${
                                    mod.tipo === 'EXCLUSION' ? 'text-red-600' : 'text-green-600'
                                  }`}
                                >
                                  {mod.tipo === 'EXCLUSION' ? `-${mod.nombre}` : `+${mod.nombre}`}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-500">
                            ${parseFloat(item.precio).toLocaleString('es-AR')} c/u
                          </p>
                        </div>
                        <button
                          onClick={() => eliminarDelCarrito(item.itemId)}
                          type="button"
                          aria-label={`Eliminar ${item.nombre} del carrito`}
                          className="text-red-400 hover:text-red-600 ml-2"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => actualizarCantidad(item.itemId, -1)}
                            type="button"
                            aria-label={`Reducir cantidad de ${item.nombre}`}
                            className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            <MinusIcon className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.cantidad}</span>
                          <button
                            onClick={() => actualizarCantidad(item.itemId, 1)}
                            type="button"
                            aria-label={`Aumentar cantidad de ${item.nombre}`}
                            className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            <PlusIcon className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-medium text-sm text-gray-900">
                          ${(parseFloat(item.precio) * item.cantidad).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Observaciones y Total */}
              <div className="p-4 border-t bg-white space-y-3">
                <label htmlFor="pedido-observaciones" className="sr-only">Observaciones</label>
                <textarea
                  id="pedido-observaciones"
                  className="input text-sm"
                  placeholder="Observaciones (opcional)"
                  rows="2"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary-600">${calcularTotal().toLocaleString('es-AR')}</span>
                </div>
                <button
                  onClick={enviarPedido}
                  disabled={enviando || carrito.length === 0}
                  className="btn btn-primary w-full py-3 disabled:opacity-50"
                  data-testid="manual-order-create-submit"
                >
                  {enviando ? 'Creando...' : 'Crear Pedido'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Modificadores */}
        {showModModal && productoSeleccionado && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
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
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium text-gray-700">Personaliza:</p>
                {modificadoresProducto.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => toggleModificador(mod)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      modificadoresSeleccionados.find(m => m.id === mod.id)
                        ? mod.tipo === 'EXCLUSION'
                          ? 'border-red-500 bg-red-50'
                          : 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={
                        modificadoresSeleccionados.find(m => m.id === mod.id)
                          ? mod.tipo === 'EXCLUSION' ? 'text-red-700' : 'text-green-700'
                          : 'text-gray-700'
                      }>
                        {mod.tipo === 'EXCLUSION' ? `Sin ${mod.nombre}` : `Extra ${mod.nombre}`}
                      </span>
                      {parseFloat(mod.precio) > 0 && (
                        <span className="text-green-600 font-medium">
                          +${parseFloat(mod.precio).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
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
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
