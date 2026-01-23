import { useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', orden: 0 })

  const cargarCategorias = useCallback(async () => {
    const response = await api.get('/categorias')
    setCategorias(response.data)
    return response.data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarCategoriasRequest = useCallback(async (_ctx) => (
    cargarCategorias()
  ), [cargarCategorias])

  const { loading, execute: cargarCategoriasAsync } = useAsync(cargarCategoriasRequest, { onError: handleLoadError })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/categorias/${editando.id}`, form)
        toast.success('Categoría actualizada')
      } else {
        await api.post('/categorias', form)
        toast.success('Categoría creada')
      }
      setShowModal(false)
      resetForm()
      cargarCategoriasAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleEdit = (categoria) => {
    setEditando(categoria)
    setForm({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      orden: categoria.orden
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try {
      await api.delete(`/categorias/${id}`)
      toast.success('Categoría eliminada')
      cargarCategoriasAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const resetForm = () => {
    setForm({ nombre: '', descripcion: '', orden: 0 })
    setEditando(null)
  }

  if (loading && categorias.length === 0) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Categoría
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categorias.map((categoria) => (
              <tr key={categoria.id}>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{categoria.orden}</td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{categoria.nombre}</td>
                <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{categoria.descripcion || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{categoria._count?.productos || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    categoria.activa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {categoria.activa ? 'Activa' : 'Inactiva'}
                  </span>
	                </td>
	                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
	                  <button
	                    aria-label={`Editar categoría: ${categoria.nombre}`}
	                    onClick={() => handleEdit(categoria)}
	                    className="text-primary-600 hover:text-primary-800"
	                  >
	                    <PencilIcon className="w-5 h-5" />
	                  </button>
	                  <button
	                    aria-label={`Eliminar categoría: ${categoria.nombre}`}
	                    onClick={() => handleDelete(categoria.id)}
	                    className="text-red-600 hover:text-red-800"
	                  >
	                    <TrashIcon className="w-5 h-5" />
	                  </button>
	                </td>
	              </tr>
	            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editando ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
	            <form onSubmit={handleSubmit} className="space-y-4">
	              <div>
	                <label className="label" htmlFor="categoria-nombre">Nombre</label>
	                <input
	                  id="categoria-nombre"
	                  type="text"
	                  className="input"
	                  value={form.nombre}
	                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
	                  required
	                />
	              </div>
	              <div>
	                <label className="label" htmlFor="categoria-descripcion">Descripción</label>
	                <textarea
	                  id="categoria-descripcion"
	                  className="input"
	                  value={form.descripcion}
	                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
	                  rows="3"
	                />
	              </div>
	              <div>
	                <label className="label" htmlFor="categoria-orden">Orden</label>
	                <input
	                  id="categoria-orden"
	                  type="number"
	                  className="input"
	                  value={form.orden}
	                  onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) })}
	                />
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
