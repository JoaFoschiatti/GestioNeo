import { useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MinusCircleIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

export default function Modificadores() {
  const [modificadores, setModificadores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    precio: '',
    tipo: 'ADICION'
  })

  const cargarModificadores = useCallback(async () => {
    const response = await api.get('/modificadores')
    setModificadores(response.data)
    return response.data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarModificadoresRequest = useCallback(async (_ctx) => (
    cargarModificadores()
  ), [cargarModificadores])

  const { loading, execute: cargarModificadoresAsync } = useAsync(
    cargarModificadoresRequest,
    { onError: handleLoadError }
  )

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
      const payload = {
        ...formData,
        precio: formData.tipo === 'EXCLUSION' ? 0 : Number(formData.precio) || 0
      }
      if (editando) {
        await api.put(`/modificadores/${editando.id}`, payload)
        toast.success('Modificador actualizado')
      } else {
        await api.post('/modificadores', payload)
        toast.success('Modificador creado')
      }
      setShowModal(false)
      cargarModificadoresAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const eliminarModificador = async (id) => {
    if (!confirm('¿Eliminar este modificador?')) return
    try {
      await api.delete(`/modificadores/${id}`)
      toast.success('Modificador eliminado')
      cargarModificadoresAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const toggleActivo = async (mod) => {
    try {
      await api.put(`/modificadores/${mod.id}`, { activo: !mod.activo })
      toast.success(mod.activo ? 'Modificador desactivado' : 'Modificador activado')
      cargarModificadoresAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  }

  const exclusiones = modificadores.filter(m => m.tipo === 'EXCLUSION')
  const adiciones = modificadores.filter(m => m.tipo === 'ADICION')

  if (loading && modificadores.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Modificadores</h1>
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
            <MinusCircleIcon className="w-6 h-6 text-error-500" />
            <h2 className="text-heading-3">Exclusiones</h2>
            <span className="text-sm text-text-tertiary">(Sin precio adicional)</span>
          </div>

          {exclusiones.length === 0 ? (
            <p className="text-text-secondary text-center py-4">No hay exclusiones</p>
          ) : (
            <div className="space-y-2">
              {exclusiones.map((mod) => (
                <div
                  key={mod.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    mod.activo ? 'bg-error-50' : 'bg-surface-hover opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${mod.activo ? 'text-error-600' : 'text-text-tertiary'}`}>
                      Sin {mod.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActivo(mod)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        mod.activo ? 'bg-success-100 text-success-600' : 'bg-surface-hover text-text-tertiary'
                      }`}
                    >
                      {mod.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      aria-label={`Editar modificador: ${mod.nombre}`}
                      onClick={() => abrirModal(mod)}
                      className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      aria-label={`Eliminar modificador: ${mod.nombre}`}
                      onClick={() => eliminarModificador(mod.id)}
                      className="p-1 text-error-400 hover:text-error-600 transition-colors"
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
            <PlusCircleIcon className="w-6 h-6 text-success-500" />
            <h2 className="text-heading-3">Adiciones (Extras)</h2>
            <span className="text-sm text-text-tertiary">(Con precio adicional)</span>
          </div>

          {adiciones.length === 0 ? (
            <p className="text-text-secondary text-center py-4">No hay adiciones</p>
          ) : (
            <div className="space-y-2">
              {adiciones.map((mod) => (
                <div
                  key={mod.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    mod.activo ? 'bg-success-50' : 'bg-surface-hover opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${mod.activo ? 'text-success-600' : 'text-text-tertiary'}`}>
                      Extra {mod.nombre}
                    </span>
                    <span className="text-sm text-success-500 font-medium">
                      +{formatCurrency(mod.precio)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActivo(mod)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        mod.activo ? 'bg-success-100 text-success-600' : 'bg-surface-hover text-text-tertiary'
                      }`}
                    >
                      {mod.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      aria-label={`Editar modificador: ${mod.nombre}`}
                      onClick={() => abrirModal(mod)}
                      className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      aria-label={`Eliminar modificador: ${mod.nombre}`}
                      onClick={() => eliminarModificador(mod.id)}
                      className="p-1 text-error-400 hover:text-error-600 transition-colors"
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
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="text-heading-3 mb-4">
              {editando ? 'Editar Modificador' : 'Nuevo Modificador'}
            </h3>

            <form onSubmit={guardarModificador} className="space-y-4">
              <div>
                <label htmlFor="modificador-tipo" className="label">
                  Tipo
                </label>
                <select
                  id="modificador-tipo"
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
                <label htmlFor="modificador-nombre" className="label">
                  Nombre
                </label>
                <input
                  id="modificador-nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="input"
                  placeholder={formData.tipo === 'EXCLUSION' ? 'ej: cebolla' : 'ej: queso'}
                  required
                />
                <p className="input-hint">
                  Se mostrara como: {formData.tipo === 'EXCLUSION' ? 'Sin' : 'Extra'} {formData.nombre || '...'}
                </p>
              </div>

              {formData.tipo === 'ADICION' && (
                <div>
                  <label htmlFor="modificador-precio" className="label">
                    Precio adicional
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                    <input
                      id="modificador-precio"
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

              <div className="modal-footer">
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
