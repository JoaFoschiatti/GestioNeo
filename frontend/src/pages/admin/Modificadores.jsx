import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MinusCircleIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline'

export default function Modificadores() {
  const [modificadores, setModificadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    precio: '',
    tipo: 'ADICION'
  })

  useEffect(() => {
    cargarModificadores()
  }, [])

  const cargarModificadores = async () => {
    try {
      const response = await api.get('/modificadores')
      setModificadores(response.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModal = (mod = null) => {
    if (mod) {
      setEditando(mod)
      setFormData({
        nombre: mod.nombre,
        precio: mod.precio,
        tipo: mod.tipo
      })
    } else {
      setEditando(null)
      setFormData({
        nombre: '',
        precio: '',
        tipo: 'ADICION'
      })
    }
    setShowModal(true)
  }

  const guardarModificador = async (e) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/modificadores/${editando.id}`, formData)
        toast.success('Modificador actualizado')
      } else {
        await api.post('/modificadores', formData)
        toast.success('Modificador creado')
      }
      setShowModal(false)
      cargarModificadores()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar')
    }
  }

  const eliminarModificador = async (id) => {
    if (!confirm('¿Eliminar este modificador?')) return
    try {
      await api.delete(`/modificadores/${id}`)
      toast.success('Modificador eliminado')
      cargarModificadores()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al eliminar')
    }
  }

  const toggleActivo = async (mod) => {
    try {
      await api.put(`/modificadores/${mod.id}`, { activo: !mod.activo })
      toast.success(mod.activo ? 'Modificador desactivado' : 'Modificador activado')
      cargarModificadores()
    } catch (error) {
      toast.error('Error al actualizar')
    }
  }

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  }

  const exclusiones = modificadores.filter(m => m.tipo === 'EXCLUSION')
  const adiciones = modificadores.filter(m => m.tipo === 'ADICION')

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Modificadores</h1>
        <button
          onClick={() => abrirModal()}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nuevo Modificador
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exclusiones */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MinusCircleIcon className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">Exclusiones</h2>
            <span className="text-sm text-gray-500">(Sin precio adicional)</span>
          </div>

          {exclusiones.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay exclusiones</p>
          ) : (
            <div className="space-y-2">
              {exclusiones.map((mod) => (
                <div
                  key={mod.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    mod.activo ? 'bg-red-50' : 'bg-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${mod.activo ? 'text-red-700' : 'text-gray-500'}`}>
                      Sin {mod.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActivo(mod)}
                      className={`text-xs px-2 py-1 rounded ${
                        mod.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {mod.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      onClick={() => abrirModal(mod)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => eliminarModificador(mod.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adiciones */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircleIcon className="w-6 h-6 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900">Adiciones (Extras)</h2>
            <span className="text-sm text-gray-500">(Con precio adicional)</span>
          </div>

          {adiciones.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay adiciones</p>
          ) : (
            <div className="space-y-2">
              {adiciones.map((mod) => (
                <div
                  key={mod.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    mod.activo ? 'bg-green-50' : 'bg-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${mod.activo ? 'text-green-700' : 'text-gray-500'}`}>
                      Extra {mod.nombre}
                    </span>
                    <span className="text-sm text-green-600 font-medium">
                      +{formatCurrency(mod.precio)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActivo(mod)}
                      className={`text-xs px-2 py-1 rounded ${
                        mod.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {mod.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      onClick={() => abrirModal(mod)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => eliminarModificador(mod.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editando ? 'Editar Modificador' : 'Nuevo Modificador'}
            </h3>

            <form onSubmit={guardarModificador} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="input"
                  required
                >
                  <option value="EXCLUSION">Exclusion (Sin...)</option>
                  <option value="ADICION">Adicion (Extra...)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="input"
                  placeholder={formData.tipo === 'EXCLUSION' ? 'ej: cebolla' : 'ej: queso'}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se mostrara como: {formData.tipo === 'EXCLUSION' ? 'Sin' : 'Extra'} {formData.nombre || '...'}
                </p>
              </div>

              {formData.tipo === 'ADICION' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio adicional
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.precio}
                      onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                      className="input pl-8"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editando ? 'Guardar Cambios' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
