import { useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

export default function Mesas() {
  const [mesas, setMesas] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ numero: '', zona: '', capacidad: 4 })

  const cargarMesas = useCallback(async () => {
    const response = await api.get('/mesas', { skipToast: true })
    setMesas(response.data)
    return response.data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    toast.error(error.response?.data?.error?.message || 'Error al cargar mesas')
  }, [])

  const cargarMesasRequest = useCallback(async (_ctx) => (
    cargarMesas()
  ), [cargarMesas])

  const { loading, execute: cargarMesasAsync } = useAsync(cargarMesasRequest, { onError: handleLoadError })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/mesas/${editando.id}`, form, { skipToast: true })
        toast.success('Mesa actualizada')
      } else {
        await api.post('/mesas', form, { skipToast: true })
        toast.success('Mesa creada')
      }
      setShowModal(false)
      resetForm()
      cargarMesasAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al guardar mesa')
    }
  }

  const handleEdit = (mesa) => {
    setEditando(mesa)
    setForm({ numero: mesa.numero, zona: mesa.zona || '', capacidad: mesa.capacidad })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar esta mesa?')) return
    try {
      await api.delete(`/mesas/${id}`, { skipToast: true })
      toast.success('Mesa desactivada')
      cargarMesasAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al desactivar mesa')
    }
  }

  const resetForm = () => {
    setForm({ numero: '', zona: '', capacidad: 4 })
    setEditando(null)
  }

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'LIBRE': return 'badge-success'
      case 'OCUPADA': return 'badge-error'
      case 'RESERVADA': return 'badge-warning'
      default: return 'badge-info'
    }
  }

  if (loading && mesas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Mesas</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Mesa
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {mesas.map((mesa) => (
          <div
            key={mesa.id}
            className={`card card-hover text-center ${!mesa.activa ? 'opacity-50' : ''}`}
          >
            <div className="text-3xl font-bold text-text-primary mb-2">{mesa.numero}</div>
            <p className="text-sm text-text-secondary mb-2">{mesa.zona || 'Sin zona'}</p>
            <p className="text-xs text-text-tertiary mb-3">{mesa.capacidad} personas</p>
            <span className={`badge ${getEstadoBadge(mesa.estado)}`}>
              {mesa.estado}
            </span>
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => handleEdit(mesa)}
                type="button"
                aria-label={`Editar mesa ${mesa.numero}`}
                className="text-primary-500 hover:text-primary-600 transition-colors"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete(mesa.id)}
                type="button"
                aria-label={`Desactivar mesa ${mesa.numero}`}
                className="text-error-500 hover:text-error-600 transition-colors"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">
              {editando ? 'Editar Mesa' : 'Nueva Mesa'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="mesa-numero">Número de Mesa</label>
                <input
                  id="mesa-numero"
                  type="number"
                  className="input"
                  value={form.numero}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm({ ...form, numero: value === '' ? '' : parseInt(value) })
                  }}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="mesa-zona">Zona</label>
                <input
                  id="mesa-zona"
                  type="text"
                  className="input"
                  value={form.zona}
                  onChange={(e) => setForm({ ...form, zona: e.target.value })}
                  placeholder="Interior, Terraza, etc."
                />
              </div>
              <div>
                <label className="label" htmlFor="mesa-capacidad">Capacidad</label>
                <input
                  id="mesa-capacidad"
                  type="number"
                  className="input"
                  value={form.capacidad}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm({ ...form, capacidad: value === '' ? '' : parseInt(value) })
                  }}
                  min="1"
                  required
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
