import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    nombre: '', descripcion: '', precio: '', categoriaId: '', disponible: true, destacado: false
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/productos'),
        api.get('/categorias')
      ])
      setProductos(prodRes.data)
      setCategorias(catRes.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...form, precio: parseFloat(form.precio) }
      if (editando) {
        await api.put(`/productos/${editando.id}`, data)
        toast.success('Producto actualizado')
      } else {
        await api.post('/productos', data)
        toast.success('Producto creado')
      }
      setShowModal(false)
      resetForm()
      cargarDatos()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleEdit = (producto) => {
    setEditando(producto)
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio,
      categoriaId: producto.categoriaId,
      disponible: producto.disponible,
      destacado: producto.destacado
    })
    setShowModal(true)
  }

  const handleToggleDisponible = async (producto) => {
    try {
      await api.patch(`/productos/${producto.id}/disponibilidad`, {
        disponible: !producto.disponible
      })
      toast.success(producto.disponible ? 'Producto desactivado' : 'Producto activado')
      cargarDatos()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const resetForm = () => {
    setForm({ nombre: '', descripcion: '', precio: '', categoriaId: '', disponible: true, destacado: false })
    setEditando(null)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nuevo Producto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {productos.map((producto) => (
          <div
            key={producto.id}
            className={`card ${!producto.disponible ? 'opacity-60' : ''}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{producto.nombre}</h3>
                <p className="text-sm text-gray-500">{producto.categoria?.nombre}</p>
              </div>
              {producto.destacado && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Destacado</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{producto.descripcion || 'Sin descripción'}</p>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-primary-600">
                ${parseFloat(producto.precio).toLocaleString('es-AR')}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleDisponible(producto)}
                  className={`px-2 py-1 text-xs rounded ${
                    producto.disponible
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {producto.disponible ? 'Disponible' : 'No disponible'}
                </button>
                <button onClick={() => handleEdit(producto)} className="text-primary-600 hover:text-primary-800">
                  <PencilIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editando ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  type="text"
                  className="input"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea
                  className="input"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Precio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select
                    className="input"
                    value={form.categoriaId}
                    onChange={(e) => setForm({ ...form, categoriaId: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.disponible}
                    onChange={(e) => setForm({ ...form, disponible: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Disponible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.destacado}
                    onChange={(e) => setForm({ ...form, destacado: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Destacado</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
