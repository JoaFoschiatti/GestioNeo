import { useState, useMemo, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, CheckIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

export default function Liquidaciones() {
  const [liquidaciones, setLiquidaciones] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    empleadoId: '', periodoDesde: '', periodoHasta: '', horasTotales: '', descuentos: 0, adicionales: 0, observaciones: ''
  })

  // Obtener empleado seleccionado y calcular totales
  const empleadoSeleccionado = useMemo(() =>
    empleados.find(e => e.id === parseInt(form.empleadoId)),
    [empleados, form.empleadoId]
  )

  const tarifaHora = empleadoSeleccionado ? parseFloat(empleadoSeleccionado.tarifaHora) : 0
  const horas = parseFloat(form.horasTotales) || 0
  const subtotal = horas * tarifaHora
  const totalPagar = subtotal - (parseFloat(form.descuentos) || 0) + (parseFloat(form.adicionales) || 0)

  const cargarDatos = useCallback(async () => {
    const [liqRes, empRes] = await Promise.all([
      api.get('/liquidaciones'),
      api.get('/empleados?activo=true')
    ])
    setLiquidaciones(liqRes.data)
    setEmpleados(empRes.data)
    return { liquidaciones: liqRes.data, empleados: empRes.data }
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarDatosRequest = useCallback(async (_ctx) => (
    cargarDatos()
  ), [cargarDatos])

  const { loading, execute: cargarDatosAsync } = useAsync(
    cargarDatosRequest,
    { onError: handleLoadError }
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.horasTotales || parseFloat(form.horasTotales) <= 0) {
      toast.error('Ingresa las horas trabajadas')
      return
    }
    try {
      await api.post('/liquidaciones', {
        empleadoId: parseInt(form.empleadoId),
        periodoDesde: form.periodoDesde,
        periodoHasta: form.periodoHasta,
        horasTotales: parseFloat(form.horasTotales),
        descuentos: parseFloat(form.descuentos) || 0,
        adicionales: parseFloat(form.adicionales) || 0,
        observaciones: form.observaciones
      })
      toast.success('Liquidación creada')
      setShowModal(false)
      setForm({ empleadoId: '', periodoDesde: '', periodoHasta: '', horasTotales: '', descuentos: 0, adicionales: 0, observaciones: '' })
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const marcarPagada = async (id) => {
    if (!confirm('¿Marcar como pagada?')) return
    try {
      await api.patch(`/liquidaciones/${id}/pagar`)
      toast.success('Marcada como pagada')
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  if (loading && liquidaciones.length === 0 && empleados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1">Liquidaciones de Sueldos</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Liquidación
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Período</th>
              <th>Horas</th>
              <th>Total</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {liquidaciones.map((liq) => (
              <tr key={liq.id}>
                <td>
                  <div className="font-medium text-text-primary">
                    {liq.empleado?.nombre} {liq.empleado?.apellido}
                  </div>
                </td>
                <td className="text-text-secondary">
                  {new Date(liq.periodoDesde).toLocaleDateString('es-AR')} -
                  {new Date(liq.periodoHasta).toLocaleDateString('es-AR')}
                </td>
                <td className="text-text-secondary">
                  {parseFloat(liq.horasTotales).toFixed(1)}h
                </td>
                <td className="font-medium text-text-primary">
                  ${parseFloat(liq.totalPagar).toLocaleString('es-AR')}
                </td>
                <td>
                  <span className={`badge ${liq.pagado ? 'badge-success' : 'badge-warning'}`}>
                    {liq.pagado ? 'Pagado' : 'Pendiente'}
                  </span>
                </td>
                <td className="text-right">
                  {!liq.pagado && (
                    <button
                      onClick={() => marcarPagada(liq.id)}
                      className="text-success-500 hover:text-success-600 transition-colors"
                      title="Marcar como pagada"
                      aria-label={`Marcar liquidación #${liq.id} como pagada`}
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
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <h2 className="text-heading-3 mb-4">Nueva Liquidación</h2>
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label" htmlFor="liquidacion-empleado">Empleado</label>
                <select
                  id="liquidacion-empleado"
                  className="input"
                  value={form.empleadoId}
                  onChange={(e) => setForm({ ...form, empleadoId: e.target.value })}
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
                  <label className="label" htmlFor="liquidacion-desde">Período Desde</label>
                  <input
                    id="liquidacion-desde"
                    type="date"
                    className="input"
                    value={form.periodoDesde}
                    onChange={(e) => setForm({ ...form, periodoDesde: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="liquidacion-hasta">Período Hasta</label>
                  <input
                    id="liquidacion-hasta"
                    type="date"
                    className="input"
                    value={form.periodoHasta}
                    onChange={(e) => setForm({ ...form, periodoHasta: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="liquidacion-horas">Horas trabajadas</label>
                <input
                  id="liquidacion-horas"
                  type="number"
                  className="input"
                  placeholder="Ej: 160"
                  min="0"
                  step="0.5"
                  value={form.horasTotales}
                  onChange={(e) => setForm({ ...form, horasTotales: e.target.value })}
                  required
                />
              </div>

              {empleadoSeleccionado && horas > 0 && (
                <div className="p-4 bg-surface-hover rounded-xl space-y-2">
                  <div className="flex justify-between text-text-secondary">
                    <span>Horas trabajadas:</span>
                    <span className="font-medium text-text-primary">{horas}h</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Tarifa/hora:</span>
                    <span className="font-medium text-text-primary">${tarifaHora.toLocaleString('es-AR')}</span>
                  </div>
                  <hr className="border-border-default" />
                  <div className="flex justify-between text-lg font-bold text-text-primary">
                    <span>Subtotal:</span>
                    <span>${subtotal.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="liquidacion-descuentos">Descuentos ($)</label>
                  <input
                    id="liquidacion-descuentos"
                    type="number"
                    className="input"
                    value={form.descuentos}
                    onChange={(e) => setForm({ ...form, descuentos: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="liquidacion-adicionales">Adicionales ($)</label>
                  <input
                    id="liquidacion-adicionales"
                    type="number"
                    className="input"
                    value={form.adicionales}
                    onChange={(e) => setForm({ ...form, adicionales: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="liquidacion-observaciones">Observaciones</label>
                <textarea
                  id="liquidacion-observaciones"
                  className="input"
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  rows="2"
                />
              </div>

              {horas > 0 && (parseFloat(form.descuentos) > 0 || parseFloat(form.adicionales) > 0) && (
                <div className="p-4 bg-primary-50 rounded-xl">
                  <div className="flex justify-between text-lg font-bold text-primary-600">
                    <span>TOTAL A PAGAR:</span>
                    <span>${totalPagar.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={!empleadoSeleccionado || horas <= 0}>
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
