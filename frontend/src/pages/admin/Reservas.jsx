import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  CalendarDaysIcon,
  PlusIcon,
  UserIcon,
  PhoneIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

export default function Reservas() {
  const [reservas, setReservas] = useState([])
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])
  const [showModal, setShowModal] = useState(false)
  const [reservaEdit, setReservaEdit] = useState(null)
  const [formData, setFormData] = useState({
    mesaId: '',
    clienteNombre: '',
    clienteTelefono: '',
    fechaHora: '',
    cantidadPersonas: 2,
    observaciones: ''
  })

  useEffect(() => {
    cargarMesas()
  }, [])

  useEffect(() => {
    cargarReservas()
  }, [fechaFiltro])

  const cargarMesas = async () => {
    try {
      const response = await api.get('/mesas')
      setMesas(response.data.filter(m => m.activa))
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const cargarReservas = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/reservas?fecha=${fechaFiltro}`)
      setReservas(response.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModal = (reserva = null) => {
    if (reserva) {
      setReservaEdit(reserva)
      setFormData({
        mesaId: reserva.mesaId,
        clienteNombre: reserva.clienteNombre,
        clienteTelefono: reserva.clienteTelefono || '',
        fechaHora: new Date(reserva.fechaHora).toISOString().slice(0, 16),
        cantidadPersonas: reserva.cantidadPersonas,
        observaciones: reserva.observaciones || ''
      })
    } else {
      setReservaEdit(null)
      const ahora = new Date()
      ahora.setHours(ahora.getHours() + 1)
      ahora.setMinutes(0)
      setFormData({
        mesaId: '',
        clienteNombre: '',
        clienteTelefono: '',
        fechaHora: ahora.toISOString().slice(0, 16),
        cantidadPersonas: 2,
        observaciones: ''
      })
    }
    setShowModal(true)
  }

  const guardarReserva = async (e) => {
    e.preventDefault()
    try {
      if (reservaEdit) {
        await api.put(`/reservas/${reservaEdit.id}`, formData)
        toast.success('Reserva actualizada')
      } else {
        await api.post('/reservas', {
          ...formData,
          mesaId: parseInt(formData.mesaId)
        })
        toast.success('Reserva creada')
      }
      setShowModal(false)
      cargarReservas()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar')
    }
  }

  const cambiarEstado = async (id, estado) => {
    try {
      await api.patch(`/reservas/${id}/estado`, { estado })
      toast.success(
        estado === 'CLIENTE_PRESENTE' ? 'Cliente presente' :
        estado === 'NO_LLEGO' ? 'Marcado como no llegó' :
        'Reserva cancelada'
      )
      cargarReservas()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error')
    }
  }

  const eliminarReserva = async (id) => {
    if (!confirm('¿Eliminar esta reserva?')) return
    try {
      await api.delete(`/reservas/${id}`)
      toast.success('Reserva eliminada')
      cargarReservas()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error')
    }
  }

  const formatHora = (fecha) => {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'CONFIRMADA': return 'bg-blue-100 text-blue-700'
      case 'CLIENTE_PRESENTE': return 'bg-green-100 text-green-700'
      case 'NO_LLEGO': return 'bg-red-100 text-red-700'
      case 'CANCELADA': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'CONFIRMADA': return 'Confirmada'
      case 'CLIENTE_PRESENTE': return 'Presente'
      case 'NO_LLEGO': return 'No llegó'
      case 'CANCELADA': return 'Cancelada'
      default: return estado
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
        <button
          onClick={() => abrirModal()}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Reserva
        </button>
      </div>

      {/* Filtro por fecha */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            className="input max-w-xs"
          />
          <span className="text-sm text-gray-500">
            {reservas.length} reservas
          </span>
        </div>
      </div>

      {/* Lista de reservas */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : reservas.length === 0 ? (
        <div className="card text-center py-12">
          <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay reservas para esta fecha</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reservas.map((reserva) => (
            <div
              key={reserva.id}
              className={`card ${
                reserva.estado === 'CANCELADA' || reserva.estado === 'NO_LLEGO'
                  ? 'opacity-60'
                  : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-2xl font-bold text-primary-600">
                    {formatHora(reserva.fechaHora)}
                  </span>
                  <p className="text-sm text-gray-500">
                    Mesa {reserva.mesa.numero}
                    {reserva.mesa.zona && ` - ${reserva.mesa.zona}`}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getEstadoColor(reserva.estado)}`}>
                  {getEstadoLabel(reserva.estado)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{reserva.clienteNombre}</span>
                </div>
                {reserva.clienteTelefono && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <PhoneIcon className="w-4 h-4 text-gray-400" />
                    {reserva.clienteTelefono}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <UsersIcon className="w-4 h-4 text-gray-400" />
                  {reserva.cantidadPersonas} personas
                </div>
                {reserva.observaciones && (
                  <p className="text-sm text-gray-500 italic">
                    "{reserva.observaciones}"
                  </p>
                )}
              </div>

              {reserva.estado === 'CONFIRMADA' && (
                <div className="flex gap-2 pt-3 border-t">
                  <button
                    onClick={() => cambiarEstado(reserva.id, 'CLIENTE_PRESENTE')}
                    className="btn btn-success flex-1 text-sm py-2"
                  >
                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                    Llegó
                  </button>
                  <button
                    onClick={() => cambiarEstado(reserva.id, 'NO_LLEGO')}
                    className="btn btn-secondary flex-1 text-sm py-2"
                  >
                    <XCircleIcon className="w-4 h-4 mr-1" />
                    No llegó
                  </button>
                  <button
                    onClick={() => abrirModal(reserva)}
                    className="btn btn-secondary text-sm py-2 px-2"
                    title="Editar"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => cambiarEstado(reserva.id, 'CANCELADA')}
                    className="btn btn-secondary text-sm py-2 px-2 text-red-600 hover:bg-red-50"
                    title="Cancelar"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {reservaEdit ? 'Editar Reserva' : 'Nueva Reserva'}
            </h3>

            <form onSubmit={guardarReserva} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mesa
                </label>
                <select
                  value={formData.mesaId}
                  onChange={(e) => setFormData({ ...formData, mesaId: e.target.value })}
                  className="input"
                  required
                  disabled={!!reservaEdit}
                >
                  <option value="">Seleccionar mesa...</option>
                  {mesas.map((mesa) => (
                    <option key={mesa.id} value={mesa.id}>
                      Mesa {mesa.numero} {mesa.zona && `(${mesa.zona})`} - {mesa.capacidad} personas
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha y Hora
                </label>
                <input
                  type="datetime-local"
                  value={formData.fechaHora}
                  onChange={(e) => setFormData({ ...formData, fechaHora: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del cliente
                </label>
                <input
                  type="text"
                  value={formData.clienteNombre}
                  onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={formData.clienteTelefono}
                  onChange={(e) => setFormData({ ...formData, clienteTelefono: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad de personas
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.cantidadPersonas}
                  onChange={(e) => setFormData({ ...formData, cantidadPersonas: parseInt(e.target.value) })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="input"
                  rows="2"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {reservaEdit ? 'Guardar Cambios' : 'Crear Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
