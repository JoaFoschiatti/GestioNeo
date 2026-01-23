import { useCallback, useState } from 'react'
import api from '../services/api'

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
