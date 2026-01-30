import { useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import useAsync from '../../hooks/useAsync'
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

  const cargarMesas = useCallback(async () => {
    const response = await api.get('/mesas')
    setMesas(response.data.filter(m => m.activa))
    return response.data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarMesasRequest = useCallback(async (_ctx) => (
    cargarMesas()
  ), [cargarMesas])

  const cargarReservas = useCallback(async () => {
    const response = await api.get(`/reservas?fecha=${fechaFiltro}`)
    setReservas(response.data)
    return response.data
  }, [fechaFiltro])

  const cargarReservasRequest = useCallback(async (_ctx) => (
    cargarReservas()
  ), [cargarReservas])

  useAsync(cargarMesasRequest, { onError: handleLoadError })
  const { loading, execute: cargarReservasAsync } = useAsync(
    cargarReservasRequest,
    { onError: handleLoadError }
  )

  // Convierte fecha UTC a string para datetime-local (en hora local)
  const toLocalDatetimeString = (isoDate) => {
    const d = new Date(isoDate)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const abrirModal = (reserva = null) => {
    if (reserva) {
      setReservaEdit(reserva)
      setFormData({
        mesaId: reserva.mesaId,
        clienteNombre: reserva.clienteNombre,
        clienteTelefono: reserva.clienteTelefono || '',
        fechaHora: toLocalDatetimeString(reserva.fechaHora),
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
        await api.put(`/reservas/${reservaEdit.id}`, formData, { skipToast: true })
        toast.success('Reserva actualizada')
      } else {
        await api.post('/reservas', {
          ...formData,
          mesaId: parseInt(formData.mesaId)
        }, { skipToast: true })
        toast.success('Reserva creada')
      }
      setShowModal(false)
      cargarReservasAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al guardar')
    }
  }

  const cambiarEstado = async (id, estado) => {
    try {
      await api.patch(`/reservas/${id}/estado`, { estado }, { skipToast: true })
      toast.success(
        estado === 'CLIENTE_PRESENTE' ? 'Cliente presente' :
        estado === 'NO_LLEGO' ? 'Marcado como no llegó' :
        'Reserva cancelada'
      )
      cargarReservasAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error')
    }
  }

  const eliminarReserva = async (id) => {
    if (!confirm('¿Eliminar esta reserva?')) return
    try {
      await api.delete(`/reservas/${id}`, { skipToast: true })
      toast.success('Reserva eliminada')
      cargarReservasAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error')
    }
  }

  const formatHora = (fecha) => {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'CONFIRMADA': return 'badge-info'
      case 'CLIENTE_PRESENTE': return 'badge-success'
      case 'NO_LLEGO': return 'badge-error'
      case 'CANCELADA': return 'badge-warning'
      default: return 'badge-info'
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
        <h1 className="text-heading-1">Reservas</h1>
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
          <CalendarDaysIcon className="w-5 h-5 text-text-tertiary" />
          <label htmlFor="reservas-fecha" className="sr-only">Fecha</label>
          <input
            id="reservas-fecha"
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            className="input max-w-xs"
          />
          <span className="text-sm text-text-secondary">
            {reservas.length} reservas
          </span>
        </div>
      </div>

      {/* Lista de reservas */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner spinner-lg" />
        </div>
      ) : reservas.length === 0 ? (
        <div className="card text-center py-12">
          <CalendarDaysIcon className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
          <p className="text-text-secondary">No hay reservas para esta fecha</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reservas.map((reserva) => (
            <div
              key={reserva.id}
              className={`card card-hover ${
                reserva.estado === 'CANCELADA' || reserva.estado === 'NO_LLEGO'
                  ? 'opacity-60'
                  : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-2xl font-bold text-primary-500">
                    {formatHora(reserva.fechaHora)}
                  </span>
                  <p className="text-sm text-text-secondary">
                    Mesa {reserva.mesa.numero}
                    {reserva.mesa.zona && ` - ${reserva.mesa.zona}`}
                  </p>
                </div>
                <span className={`badge ${getEstadoBadge(reserva.estado)}`}>
                  {getEstadoLabel(reserva.estado)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <UserIcon className="w-4 h-4 text-text-tertiary" />
                  <span className="font-medium text-text-primary">{reserva.clienteNombre}</span>
                </div>
                {reserva.clienteTelefono && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <PhoneIcon className="w-4 h-4 text-text-tertiary" />
                    {reserva.clienteTelefono}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <UsersIcon className="w-4 h-4 text-text-tertiary" />
                  {reserva.cantidadPersonas} personas
                </div>
                {reserva.observaciones && (
                  <p className="text-sm text-text-tertiary italic">
                    "{reserva.observaciones}"
                  </p>
                )}
              </div>

              {reserva.estado === 'CONFIRMADA' && (
                <div className="flex gap-2 pt-3 border-t border-border-default">
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
                    aria-label={`Editar reserva: ${reserva.clienteNombre}`}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => cambiarEstado(reserva.id, 'CANCELADA')}
                    className="btn btn-danger text-sm py-2 px-2"
                    title="Cancelar"
                    aria-label={`Cancelar reserva: ${reserva.clienteNombre}`}
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
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="text-heading-3 mb-4">
              {reservaEdit ? 'Editar Reserva' : 'Nueva Reserva'}
            </h3>

            <form onSubmit={guardarReserva} className="space-y-4">
              <div>
                <label className="label" htmlFor="reserva-mesa">
                  Mesa
                </label>
                <select
                  id="reserva-mesa"
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
                <label className="label" htmlFor="reserva-fecha-hora">
                  Fecha y Hora
                </label>
                <input
                  id="reserva-fecha-hora"
                  type="datetime-local"
                  value={formData.fechaHora}
                  onChange={(e) => setFormData({ ...formData, fechaHora: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="reserva-cliente-nombre">
                  Nombre del cliente
                </label>
                <input
                  id="reserva-cliente-nombre"
                  type="text"
                  value={formData.clienteNombre}
                  onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="reserva-cliente-telefono">
                  Teléfono (opcional)
                </label>
                <input
                  id="reserva-cliente-telefono"
                  type="tel"
                  value={formData.clienteTelefono}
                  onChange={(e) => setFormData({ ...formData, clienteTelefono: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor="reserva-cantidad-personas">
                  Cantidad de personas
                </label>
                <input
                  id="reserva-cantidad-personas"
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
                <label className="label" htmlFor="reserva-observaciones">
                  Observaciones (opcional)
                </label>
                <textarea
                  id="reserva-observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="input"
                  rows="2"
                />
              </div>

              <div className="modal-footer">
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
