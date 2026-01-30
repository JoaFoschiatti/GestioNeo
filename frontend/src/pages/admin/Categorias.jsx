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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Categorías</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Categoría
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Productos</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => (
              <tr key={categoria.id}>
                <td className="text-text-tertiary">{categoria.orden}</td>
                <td className="font-medium text-text-primary">{categoria.nombre}</td>
                <td className="text-text-secondary max-w-xs truncate">{categoria.descripcion || '-'}</td>
                <td className="text-text-secondary">{categoria._count?.productos || 0}</td>
                <td>
                  <span className={`badge ${categoria.activa ? 'badge-success' : 'badge-error'}`}>
                    {categoria.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="text-right space-x-2">
                  <button
                    aria-label={`Editar categoría: ${categoria.nombre}`}
                    onClick={() => handleEdit(categoria)}
                    className="text-primary-500 hover:text-primary-600 transition-colors"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    aria-label={`Eliminar categoría: ${categoria.nombre}`}
                    onClick={() => handleDelete(categoria.id)}
                    className="text-error-500 hover:text-error-600 transition-colors"
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
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">
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
              <div className="modal-footer">
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
