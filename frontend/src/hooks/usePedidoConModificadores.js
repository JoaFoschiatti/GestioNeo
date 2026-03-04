import { useCallback, useState } from 'react'
import api from '../services/api'

/**
 * Hook para manejar la lógica del carrito con modificadores.
 *
 * Los modificadores son extras o exclusiones de un producto:
 * - Exclusiones (tipo: 'EXCLUSION'): "Sin cebolla", "Sin mayonesa"
 * - Adiciones (tipo: 'ADICION'): "+Queso extra", "+Bacon"
 *
 * Cada modificador puede tener un precio adicional (puede ser 0).
 *
 * Este hook maneja:
 * - Agregar productos al carrito
 * - Mostrar modal de modificadores cuando el producto los tiene
 * - Calcular precio total con modificadores
 * - Actualizar cantidades y eliminar items
 *
 * @param {Object} [options] - Opciones de configuración
 * @param {Function} [options.onItemAdded] - Callback cuando se agrega un item
 *
 * @returns {Object} Estado y funciones del carrito
 * @returns {Array} returns.carrito - Items en el carrito
 * @returns {boolean} returns.showModModal - Si mostrar modal de modificadores
 * @returns {Object|null} returns.productoSeleccionado - Producto actual para modificadores
 * @returns {Array} returns.modificadoresProducto - Modificadores disponibles
 * @returns {Array} returns.modificadoresSeleccionados - Modificadores seleccionados
 * @returns {Function} returns.handleClickProducto - Handler al hacer click en producto
 * @returns {Function} returns.toggleModificador - Seleccionar/deseleccionar modificador
 * @returns {Function} returns.confirmarProductoConModificadores - Confirmar y agregar al carrito
 * @returns {Function} returns.agregarAlCarrito - Agregar producto directamente
 * @returns {Function} returns.actualizarCantidad - Cambiar cantidad de un item
 * @returns {Function} returns.eliminarDelCarrito - Eliminar item del carrito
 * @returns {Function} returns.actualizarObservacionItem - Agregar observación a un item
 * @returns {Function} returns.resetCarrito - Vaciar el carrito
 * @returns {Function} returns.closeModModal - Cerrar modal de modificadores
 *
 * @example
 * const {
 *   carrito,
 *   handleClickProducto,
 *   showModModal,
 *   modificadoresProducto,
 *   modificadoresSeleccionados,
 *   toggleModificador,
 *   confirmarProductoConModificadores,
 *   closeModModal,
 *   actualizarCantidad,
 *   resetCarrito
 * } = usePedidoConModificadores({
 *   onItemAdded: (producto) => toast.success(`${producto.nombre} agregado`)
 * });
 *
 * // Al hacer click en un producto
 * <div onClick={() => handleClickProducto(producto)}>
 *   {producto.nombre}
 * </div>
 *
 * // Si tiene modificadores, se abre el modal automáticamente
 * // Si no tiene, se agrega directo al carrito
 *
 * // Estructura de item en carrito:
 * // {
 * //   itemId: 'producto-1-1234567890',  // ID único del item
 * //   productoId: 1,
 * //   nombre: 'Hamburguesa',
 * //   precioBase: 1500,
 * //   precio: 1700,  // 1500 + 200 de queso extra
 * //   cantidad: 2,
 * //   observaciones: '',
 * //   modificadores: [
 * //     { id: 1, nombre: 'Sin cebolla', tipo: 'EXCLUSION', precio: 0 },
 * //     { id: 5, nombre: '+Queso extra', tipo: 'ADICION', precio: 200 }
 * //   ]
 * // }
 *
 * // Calcular total del carrito
 * const total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
 */
export default function usePedidoConModificadores(options = {}) {
  const { onItemAdded } = options

  const [carrito, setCarrito] = useState([])
  const [showModModal, setShowModModal] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [modificadoresProducto, setModificadoresProducto] = useState([])
  const [modificadoresSeleccionados, setModificadoresSeleccionados] = useState([])

  const closeModModal = useCallback(() => {
    setShowModModal(false)
    setProductoSeleccionado(null)
    setModificadoresProducto([])
    setModificadoresSeleccionados([])
  }, [])

  const agregarAlCarrito = useCallback((producto, modificadores = []) => {
    const precioMods = modificadores.reduce((sum, m) => sum + parseFloat(m.precio), 0)
    const precioTotal = parseFloat(producto.precio) + precioMods
    const itemId = `${producto.id}-${Date.now()}`

    setCarrito(prev => [
      ...prev,
      {
        itemId,
        productoId: producto.id,
        nombre: producto.nombre,
        precioBase: producto.precio,
        precio: precioTotal,
        cantidad: 1,
        observaciones: '',
        modificadores: modificadores.map(m => ({
          id: m.id,
          nombre: m.nombre,
          tipo: m.tipo,
          precio: m.precio
        }))
      }
    ])

    if (onItemAdded) {
      onItemAdded(producto)
    }
  }, [onItemAdded])

  const handleClickProducto = useCallback(async (producto) => {
    try {
      const response = await api.get(`/modificadores/producto/${producto.id}`, { skipToast: true })
      const mods = response.data.filter(m => m.activo)

      if (mods.length > 0) {
        setProductoSeleccionado(producto)
        setModificadoresProducto(mods)
        setModificadoresSeleccionados([])
        setShowModModal(true)
      } else {
        agregarAlCarrito(producto, [])
      }
    } catch (error) {
      agregarAlCarrito(producto, [])
    }
  }, [agregarAlCarrito])

  const toggleModificador = useCallback((mod) => {
    setModificadoresSeleccionados(prev => {
      const existe = prev.find(m => m.id === mod.id)
      if (existe) {
        return prev.filter(m => m.id !== mod.id)
      }
      return [...prev, mod]
    })
  }, [])

  const confirmarProductoConModificadores = useCallback(() => {
    if (productoSeleccionado) {
      agregarAlCarrito(productoSeleccionado, modificadoresSeleccionados)
      closeModModal()
    }
  }, [agregarAlCarrito, closeModModal, modificadoresSeleccionados, productoSeleccionado])

  const actualizarCantidad = useCallback((itemId, delta) => {
    setCarrito(prev =>
      prev.map(item => {
        if (item.itemId === itemId) {
          const nuevaCantidad = item.cantidad + delta
          return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : item
        }
        return item
      }).filter(item => item.cantidad > 0)
    )
  }, [])

  const eliminarDelCarrito = useCallback((itemId) => {
    setCarrito(prev => prev.filter(item => item.itemId !== itemId))
  }, [])

  const actualizarObservacionItem = useCallback((itemId, obs) => {
    setCarrito(prev =>
      prev.map(item =>
        item.itemId === itemId ? { ...item, observaciones: obs } : item
      )
    )
  }, [])

  const resetCarrito = useCallback(() => {
    setCarrito([])
  }, [])

  return {
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
    resetCarrito,
    closeModModal
  }
}
