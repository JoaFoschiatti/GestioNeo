import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, CheckIcon, CalculatorIcon } from '@heroicons/react/24/outline'

export default function Liquidaciones() {
  const [liquidaciones, setLiquidaciones] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState({
    empleadoId: '', periodoDesde: '', periodoHasta: '', descuentos: 0, adicionales: 0, observaciones: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [liqRes, empRes] = await Promise.all([
        api.get('/liquidaciones'),
        api.get('/empleados?activo=true')
      ])
      setLiquidaciones(liqRes.data)
      setEmpleados(empRes.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularPreview = async () => {
    if (!form.empleadoId || !form.periodoDesde || !form.periodoHasta) {
      toast.error('Completa empleado y período')
      return
    }
    try {
      const response = await api.post('/liquidaciones/calcular', {
        empleadoId: parseInt(form.empleadoId),
        fechaDesde: form.periodoDesde,
        fechaHasta: form.periodoHasta
      })
      setPreview(response.data)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!preview) {
      toast.error('Primero calcula la liquidación')
      return
    }
    try {
      await api.post('/liquidaciones', {
        empleadoId: parseInt(form.empleadoId),
        periodoDesde: form.periodoDesde,
        periodoHasta: form.periodoHasta,
        descuentos: parseFloat(form.descuentos) || 0,
        adicionales: parseFloat(form.adicionales) || 0,
        observaciones: form.observaciones
      })
      toast.success('Liquidación creada')
      setShowModal(false)
      setForm({ empleadoId: '', periodoDesde: '', periodoHasta: '', descuentos: 0, adicionales: 0, observaciones: '' })
      setPreview(null)
      cargarDatos()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const marcarPagada = async (id) => {
    if (!confirm('¿Marcar como pagada?')) return
    try {
      await api.patch(`/liquidaciones/${id}/pagar`)
      toast.success('Marcada como pagada')
      cargarDatos()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Liquidaciones de Sueldos</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Liquidación
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {liquidaciones.map((liq) => (
              <tr key={liq.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {liq.empleado?.nombre} {liq.empleado?.apellido}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {new Date(liq.periodoDesde).toLocaleDateString('es-AR')} -
                  {new Date(liq.periodoHasta).toLocaleDateString('es-AR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {parseFloat(liq.horasTotales).toFixed(1)}h
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  ${parseFloat(liq.totalPagar).toLocaleString('es-AR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    liq.pagado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {liq.pagado ? 'Pagado' : 'Pendiente'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {!liq.pagado && (
                    <button
                      onClick={() => marcarPagada(liq.id)}
                      className="text-green-600 hover:text-green-800"
                      title="Marcar como pagada"
                    >
                      <CheckIcon className="w-5 h-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Nueva Liquidación</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Empleado</label>
                <select
                  className="input"
                  value={form.empleadoId}
                  onChange={(e) => { setForm({ ...form, empleadoId: e.target.value }); setPreview(null) }}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} {emp.apellido} - {emp.rol}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Período Desde</label>
                  <input
                    type="date"
                    className="input"
                    value={form.periodoDesde}
                    onChange={(e) => { setForm({ ...form, periodoDesde: e.target.value }); setPreview(null) }}
                    required
                  />
                </div>
                <div>
                  <label className="label">Período Hasta</label>
                  <input
                    type="date"
                    className="input"
                    value={form.periodoHasta}
                    onChange={(e) => { setForm({ ...form, periodoHasta: e.target.value }); setPreview(null) }}
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={calcularPreview}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <CalculatorIcon className="w-5 h-5" />
                Calcular
              </button>

              {preview && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Fichajes:</span>
                    <span className="font-medium">{preview.totalFichajes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Horas totales:</span>
                    <span className="font-medium">{preview.horasTotales.toFixed(2)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarifa/hora:</span>
                    <span className="font-medium">${preview.tarifaHora}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Subtotal:</span>
                    <span>${preview.subtotal.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Descuentos ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.descuentos}
                    onChange={(e) => setForm({ ...form, descuentos: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Adicionales ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.adicionales}
                    onChange={(e) => setForm({ ...form, adicionales: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Observaciones</label>
                <textarea
                  className="input"
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  rows="2"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={!preview}>
                  Crear Liquidación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
