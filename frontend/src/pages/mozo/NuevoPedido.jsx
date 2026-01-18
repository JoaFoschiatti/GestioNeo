import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, MinusIcon, TrashIcon, PrinterIcon } from '@heroicons/react/24/outline'

export default function NuevoPedido() {
  const { mesaId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [mesa, setMesa] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [carrito, setCarrito] = useState([])
  const [tipo, setTipo] = useState(mesaId ? 'MESA' : 'DELIVERY')
  const [clienteData, setClienteData] = useState({ nombre: '', telefono: '', direccion: '' })
  const [observaciones, setObservaciones] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [mesaId])

  const cargarDatos = async () => {
    try {
      const catRes = await api.get('/categorias/publicas')
      setCategorias(catRes.data)
      if (catRes.data.length > 0) {
        setCategoriaActiva(catRes.data[0].id)
      }

      if (mesaId) {
        const mesaRes = await api.get(`/mesas/${mesaId}`)
        setMesa(mesaRes.data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.productoId === producto.id)
      if (existe) {
        return prev.map((item) =>
          item.productoId === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }
      return [...prev, {
        productoId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        observaciones: ''
      }]
    })
  }

  const actualizarCantidad = (productoId, delta) => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.productoId === productoId) {
          const nuevaCantidad = item.cantidad + delta
          return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : item
        }
        return item
      }).filter((item) => item.cantidad > 0)
    )
  }

  const eliminarDelCarrito = (productoId) => {
    setCarrito((prev) => prev.filter((item) => item.productoId !== productoId))
  }

  const actualizarObservacionItem = (productoId, obs) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.productoId === productoId ? { ...item, observaciones: obs } : item
      )
    )
  }

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
        items: carrito.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          observaciones: item.observaciones || null
        })),
        observaciones,
        ...(tipo === 'DELIVERY' && {
          clienteNombre: clienteData.nombre,
          clienteTelefono: clienteData.telefono,
          clienteDireccion: clienteData.direccion
        })
      }

      const response = await api.post('/pedidos', pedidoData)
      toast.success(`Pedido #${response.data.id} creado!`)

      // Imprimir comandas
      try {
        await api.post(`/impresion/comanda/${response.data.id}`)
        toast.success('Comandas enviadas a imprimir')
      } catch (e) {
        console.log('Impresión no disponible')
      }

      navigate(tipo === 'MESA' ? '/mozo/mesas' : '/pedidos')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const productosFiltrados = categorias.find((c) => c.id === categoriaActiva)?.productos || []

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Panel izquierdo: Productos */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            {tipo === 'MESA' ? `Nuevo Pedido - Mesa ${mesa?.numero}` : 'Nuevo Pedido'}
          </h1>
          {!mesaId && (
            <select
              className="input w-40"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="DELIVERY">Delivery</option>
              <option value="MOSTRADOR">Mostrador</option>
            </select>
          )}
        </div>

        {/* Categorías */}
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {productosFiltrados.map((producto) => (
              <button
                key={producto.id}
                onClick={() => agregarAlCarrito(producto)}
                className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left"
              >
                <h3 className="font-medium text-gray-900 mb-1">{producto.nombre}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">{producto.descripcion}</p>
                <p className="text-primary-600 font-bold">
                  ${parseFloat(producto.precio).toLocaleString('es-AR')}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho: Carrito */}
      <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm border p-4 flex flex-col">
        <h2 className="font-bold text-gray-900 mb-4">Pedido</h2>

        {/* Datos cliente (delivery) */}
        {tipo === 'DELIVERY' && (
          <div className="space-y-3 mb-4 pb-4 border-b">
            <input
              type="text"
              className="input"
              placeholder="Nombre del cliente *"
              value={clienteData.nombre}
              onChange={(e) => setClienteData({ ...clienteData, nombre: e.target.value })}
            />
            <input
              type="text"
              className="input"
              placeholder="Teléfono"
              value={clienteData.telefono}
              onChange={(e) => setClienteData({ ...clienteData, telefono: e.target.value })}
            />
            <input
              type="text"
              className="input"
              placeholder="Dirección de entrega"
              value={clienteData.direccion}
              onChange={(e) => setClienteData({ ...clienteData, direccion: e.target.value })}
            />
          </div>
        )}

        {/* Items del carrito */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {carrito.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Agrega productos al pedido</p>
          ) : (
            carrito.map((item) => (
              <div key={item.productoId} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.nombre}</h4>
                    <p className="text-sm text-gray-500">
                      ${parseFloat(item.precio).toLocaleString('es-AR')} c/u
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarDelCarrito(item.productoId)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => actualizarCantidad(item.productoId, -1)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(item.productoId, 1)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="font-medium text-gray-900">
                    ${(parseFloat(item.precio) * item.cantidad).toLocaleString('es-AR')}
                  </span>
                </div>
                <input
                  type="text"
                  className="input mt-2 text-sm"
                  placeholder="Observaciones (sin cebolla, etc.)"
                  value={item.observaciones}
                  onChange={(e) => actualizarObservacionItem(item.productoId, e.target.value)}
                />
              </div>
            ))
          )}
        </div>

        {/* Observaciones generales */}
        <div className="mt-4 pt-4 border-t">
          <textarea
            className="input text-sm"
            placeholder="Observaciones del pedido"
            rows="2"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        {/* Total y botón */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between text-xl font-bold mb-4">
            <span>Total:</span>
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
    </div>
  )
}
