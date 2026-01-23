import { useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

export default function Empleados() {
  const [empleados, setEmpleados] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', direccion: '', rol: 'MOZO', tarifaHora: ''
  })

  const cargarEmpleados = useCallback(async () => {
    const response = await api.get('/empleados', { skipToast: true })
    setEmpleados(response.data)
    return response.data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    toast.error(error.response?.data?.error?.message || 'Error al cargar empleados')
  }, [])

  const cargarEmpleadosRequest = useCallback(async (_ctx) => (
    cargarEmpleados()
  ), [cargarEmpleados])

  const { loading, execute: cargarEmpleadosAsync } = useAsync(cargarEmpleadosRequest, { onError: handleLoadError })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/empleados/${editando.id}`, form, { skipToast: true })
        toast.success('Empleado actualizado')
      } else {
        await api.post('/empleados', form, { skipToast: true })
        toast.success('Empleado creado')
      }
      setShowModal(false)
      resetForm()
      cargarEmpleadosAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al guardar empleado')
    }
  }

  const handleEdit = (empleado) => {
    setEditando(empleado)
    setForm({
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      dni: empleado.dni,
      telefono: empleado.telefono || '',
      direccion: empleado.direccion || '',
      rol: empleado.rol,
      tarifaHora: empleado.tarifaHora
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este empleado?')) return
    try {
      await api.delete(`/empleados/${id}`, { skipToast: true })
      toast.success('Empleado desactivado')
      cargarEmpleadosAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al desactivar empleado')
    }
  }

  const resetForm = () => {
    setForm({ nombre: '', apellido: '', dni: '', telefono: '', direccion: '', rol: 'MOZO', tarifaHora: '' })
    setEditando(null)
  }

  if (loading && empleados.length === 0) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nuevo Empleado
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarifa/Hora</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {empleados.map((empleado) => (
              <tr key={empleado.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{empleado.nombre} {empleado.apellido}</div>
                  <div className="text-sm text-gray-500">{empleado.telefono}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{empleado.dni}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    empleado.rol === 'COCINERO' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {empleado.rol}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  ${parseFloat(empleado.tarifaHora).toLocaleString('es-AR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    empleado.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {empleado.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <button
                    onClick={() => handleEdit(empleado)}
                    type="button"
                    aria-label={`Editar empleado: ${empleado.nombre} ${empleado.apellido}`}
                    className="text-primary-600 hover:text-primary-800"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(empleado.id)}
                    type="button"
                    aria-label={`Desactivar empleado: ${empleado.nombre} ${empleado.apellido}`}
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
              {editando ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="empleado-nombre">Nombre</label>
                  <input
                    id="empleado-nombre"
                    type="text"
                    className="input"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="empleado-apellido">Apellido</label>
                  <input
                    id="empleado-apellido"
                    type="text"
                    className="input"
                    value={form.apellido}
                    onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="empleado-dni">DNI</label>
                <input
                  id="empleado-dni"
                  type="text"
                  className="input"
                  value={form.dni}
                  onChange={(e) => setForm({ ...form, dni: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="empleado-telefono">Teléfono</label>
                <input
                  id="empleado-telefono"
                  type="text"
                  className="input"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="empleado-rol">Rol</label>
                  <select
                    id="empleado-rol"
                    className="input"
                    value={form.rol}
                    onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  >
                    <option value="MOZO">Mozo</option>
                    <option value="COCINERO">Cocinero</option>
                    <option value="CAJERO">Cajero</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="empleado-tarifa">Tarifa por Hora ($)</label>
                  <input
                    id="empleado-tarifa"
                    type="number"
                    className="input"
                    value={form.tarifaHora}
                    onChange={(e) => setForm({ ...form, tarifaHora: e.target.value })}
                    required
                  />
                </div>
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
