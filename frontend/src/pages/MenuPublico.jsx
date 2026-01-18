import { useState, useEffect } from 'react'
import api from '../services/api'
import { ShoppingCartIcon, PlusIcon, MinusIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function MenuPublico() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [carrito, setCarrito] = useState([])
  const [showCarrito, setShowCarrito] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [clienteData, setClienteData] = useState({ nombre: '', telefono: '', direccion: '' })

  useEffect(() => {
    cargarMenu()
  }, [])

  const cargarMenu = async () => {
    try {
      const response = await api.get('/categorias/publicas')
      setCategorias(response.data)
      if (response.data.length > 0) {
        setCategoriaActiva(response.data[0].id)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id)
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const actualizarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
          : item
      ).filter((item) => item.cantidad > 0)
    )
  }

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0)
  }

  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const productosFiltrados = categorias.find((c) => c.id === categoriaActiva)?.productos || []

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nuestro Menú</h1>
        <p className="text-gray-500">Selecciona tus productos favoritos</p>
      </div>

      {/* Categorías */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 sticky top-0 bg-gray-50 py-2 -mx-4 px-4">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoriaActiva(cat.id)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
              categoriaActiva === cat.id
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-700 border hover:bg-gray-100'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-24">
        {productosFiltrados.map((producto) => (
          <div
            key={producto.id}
            className="bg-white rounded-xl shadow-sm border p-4 flex gap-4"
          >
            {producto.imagen && (
              <img
                src={producto.imagen}
                alt={producto.nombre}
                className="w-24 h-24 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{producto.nombre}</h3>
              <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                {producto.descripcion}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-primary-600">
                  ${parseFloat(producto.precio).toLocaleString('es-AR')}
                </span>
                <button
                  onClick={() => agregarAlCarrito(producto)}
                  className="btn btn-primary text-sm py-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  Agregar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Botón carrito flotante */}
      {totalItems > 0 && (
        <button
          onClick={() => setShowCarrito(true)}
          className="fixed bottom-6 right-6 bg-primary-500 text-white px-6 py-4 rounded-full shadow-lg flex items-center gap-3 hover:bg-primary-600 transition-colors"
        >
          <ShoppingCartIcon className="w-6 h-6" />
          <span className="font-bold">{totalItems} items</span>
          <span>|</span>
          <span className="font-bold">${calcularTotal().toLocaleString('es-AR')}</span>
        </button>
      )}

      {/* Modal Carrito */}
      {showCarrito && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-md md:rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Tu Pedido</h2>
              <button onClick={() => setShowCarrito(false)}>
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {carrito.map((item) => (
                <div key={item.id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.nombre}</h4>
                    <p className="text-sm text-gray-500">
                      ${parseFloat(item.precio).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => actualizarCantidad(item.id, -1)}
                      className="p-1 bg-gray-200 rounded"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(item.id, 1)}
                      className="p-1 bg-gray-200 rounded"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-white p-4 border-t">
              <div className="flex justify-between text-xl font-bold mb-4">
                <span>Total:</span>
                <span className="text-primary-600">
                  ${calcularTotal().toLocaleString('es-AR')}
                </span>
              </div>
              <button
                onClick={() => { setShowCarrito(false); setShowCheckout(true) }}
                className="btn btn-primary w-full py-3"
              >
                Continuar al Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-md md:rounded-xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Datos de Entrega</h2>
              <button onClick={() => setShowCheckout(false)}>
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input
                  type="text"
                  className="input"
                  value={clienteData.nombre}
                  onChange={(e) => setClienteData({ ...clienteData, nombre: e.target.value })}
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="label">Teléfono *</label>
                <input
                  type="tel"
                  className="input"
                  value={clienteData.telefono}
                  onChange={(e) => setClienteData({ ...clienteData, telefono: e.target.value })}
                  placeholder="11-xxxx-xxxx"
                />
              </div>
              <div>
                <label className="label">Dirección de Entrega *</label>
                <input
                  type="text"
                  className="input"
                  value={clienteData.direccion}
                  onChange={(e) => setClienteData({ ...clienteData, direccion: e.target.value })}
                  placeholder="Calle, número, piso, depto"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total a pagar:</span>
                  <span className="text-primary-600">
                    ${calcularTotal().toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center">
                Al confirmar, nos contactaremos por WhatsApp para coordinar el pago y la entrega.
              </p>

              <button
                onClick={() => {
                  const mensaje = `Hola! Quiero hacer un pedido:\n\n${carrito.map(i => `${i.cantidad}x ${i.nombre}`).join('\n')}\n\nTotal: $${calcularTotal().toLocaleString('es-AR')}\n\nNombre: ${clienteData.nombre}\nDirección: ${clienteData.direccion}`
                  window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank')
                }}
                className="btn btn-success w-full py-3"
                disabled={!clienteData.nombre || !clienteData.telefono || !clienteData.direccion}
              >
                Confirmar Pedido por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
