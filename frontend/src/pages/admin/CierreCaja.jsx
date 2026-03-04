import { useState, useCallback, useEffect, useMemo } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  BanknotesIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  LockClosedIcon,
  LockOpenIcon
} from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts'
import ShortcutsHelp from '../../components/ui/ShortcutsHelp'

export default function CierreCaja() {
  const [cajaActual, setCajaActual] = useState(null)
  const [historico, setHistorico] = useState([])
  const [showAbrirModal, setShowAbrirModal] = useState(false)
  const [showCerrarModal, setShowCerrarModal] = useState(false)
  const [fondoInicial, setFondoInicial] = useState('')
  const [efectivoFisico, setEfectivoFisico] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [resumen, setResumen] = useState(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  const cargarEstado = useCallback(async () => {
    const response = await api.get('/cierres/actual')
    setCajaActual(response.data)
    return response.data
  }, [])

  const cargarHistorico = useCallback(async () => {
    const response = await api.get('/cierres?limit=10')
    setHistorico(response.data)
    return response.data
  }, [])

  const cargarDatos = useCallback(async () => {
    const [estado, historial] = await Promise.all([cargarEstado(), cargarHistorico()])
    return { estado, historial }
  }, [cargarEstado, cargarHistorico])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarDatosRequest = useCallback(async (_ctx) => (
    cargarDatos()
  ), [cargarDatos])

  const { loading, execute: cargarDatosAsync } = useAsync(
    cargarDatosRequest,
    { immediate: false, onError: handleLoadError }
  )

  useEffect(() => {
    cargarDatosAsync()
      .catch(() => {})
  }, [cargarDatosAsync])

  const abrirCaja = async (e) => {
    e.preventDefault()
    try {
      await api.post('/cierres', { fondoInicial: parseFloat(fondoInicial) || 0 }, { skipToast: true })
      toast.success('Caja abierta correctamente')
      setShowAbrirModal(false)
      setFondoInicial('')
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al abrir caja')
    }
  }

  const prepararCierre = async () => {
    try {
      const response = await api.get('/cierres/resumen', { skipToast: true })
      setResumen(response.data)
      setShowCerrarModal(true)
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al obtener resumen')
    }
  }

  const cerrarCaja = async (e) => {
    e.preventDefault()
    if (!cajaActual?.caja?.id) return

    try {
      const response = await api.patch(`/cierres/${cajaActual.caja.id}/cerrar`, {
        efectivoFisico: parseFloat(efectivoFisico) || 0,
        observaciones
      }, { skipToast: true })
      toast.success('Caja cerrada correctamente')
      setShowCerrarModal(false)
      setEfectivoFisico('')
      setObservaciones('')
      setResumen(null)
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al cerrar caja')
    }
  }

  const shortcutsList = useMemo(() => [
    { key: 'A', description: 'Abrir caja' },
    { key: 'C', description: 'Cerrar caja' },
    { key: 'Esc', description: 'Cerrar modal' },
    { key: '?', description: 'Ayuda de atajos' },
  ], [])

  useKeyboardShortcuts(useMemo(() => ({
    'a': () => { if (!cajaActual?.cajaAbierta) setShowAbrirModal(true) },
    'c': () => { if (cajaActual?.cajaAbierta) prepararCierre() },
    'Escape': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false)
      else if (showCerrarModal) { setShowCerrarModal(false); setResumen(null) }
      else if (showAbrirModal) setShowAbrirModal(false)
    },
    '?': () => setShowShortcutsHelp(prev => !prev),
  }), [cajaActual?.cajaAbierta, showShortcutsHelp, showCerrarModal, showAbrirModal]))

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  }

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && !cajaActual && historico.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-heading-1 mb-6">Cierre de Caja</h1>

      {/* Estado actual */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading-3">Estado Actual</h2>
          {cajaActual?.cajaAbierta ? (
            <span className="badge badge-success flex items-center gap-2">
              <LockOpenIcon className="w-4 h-4" />
              Caja Abierta
            </span>
          ) : (
            <span className="badge badge-info flex items-center gap-2">
              <LockClosedIcon className="w-4 h-4" />
              Caja Cerrada
            </span>
          )}
        </div>

        {cajaActual?.cajaAbierta ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-info-50 p-4 rounded-xl">
                <p className="text-sm text-info-600">Fondo Inicial</p>
                <p className="text-2xl font-bold text-info-700">
                  {formatCurrency(cajaActual.caja.fondoInicial)}
                </p>
              </div>
              <div className="bg-success-50 p-4 rounded-xl">
                <p className="text-sm text-success-600">Ventas Efectivo</p>
                <p className="text-2xl font-bold text-success-700">
                  {formatCurrency(cajaActual.caja.ventasActuales?.efectivo)}
                </p>
              </div>
              <div className="bg-primary-50 p-4 rounded-xl">
                <p className="text-sm text-primary-600">Ventas Tarjeta</p>
                <p className="text-2xl font-bold text-primary-700">
                  {formatCurrency(cajaActual.caja.ventasActuales?.tarjeta)}
                </p>
              </div>
              <div className="bg-warning-50 p-4 rounded-xl">
                <p className="text-sm text-warning-600">MercadoPago</p>
                <p className="text-2xl font-bold text-warning-700">
                  {formatCurrency(cajaActual.caja.ventasActuales?.mercadopago)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl">
                <p className="text-sm text-purple-600">Propinas</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(cajaActual.caja.ventasActuales?.propinas)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border-default">
              <div>
                <p className="text-sm text-text-secondary">
                  Abierta por: {cajaActual.caja.usuario?.nombre}
                </p>
                <p className="text-sm text-text-tertiary">
                  Hora apertura: {formatDateTime(cajaActual.caja.horaApertura)}
                </p>
              </div>
              <button
                onClick={prepararCierre}
                className="btn btn-primary flex items-center gap-2"
              >
                <LockClosedIcon className="w-5 h-5" />
                Cerrar Caja
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BanknotesIcon className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary mb-4">No hay caja abierta</p>
            <button
              onClick={() => setShowAbrirModal(true)}
              className="btn btn-primary"
            >
              Abrir Caja
            </button>
          </div>
        )}
      </div>

      {/* Histórico de cierres */}
      <div className="card">
        <h2 className="text-heading-3 mb-4">Histórico de Cierres</h2>

        {historico.length === 0 ? (
          <p className="text-center text-text-secondary py-8">No hay cierres registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th className="text-right">Fondo</th>
                  <th className="text-right">Efectivo</th>
                  <th className="text-right">Tarjeta</th>
                  <th className="text-right">MP</th>
                  <th className="text-right">Propinas</th>
                  <th className="text-right">Diferencia</th>
                  <th className="text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((cierre) => (
                  <tr key={cierre.id}>
                    <td className="text-text-primary">
                      {formatDateTime(cierre.horaApertura)}
                    </td>
                    <td className="text-text-secondary">
                      {cierre.usuario?.nombre}
                    </td>
                    <td className="text-right text-text-secondary">
                      {formatCurrency(cierre.fondoInicial)}
                    </td>
                    <td className="text-right text-success-600">
                      {formatCurrency(cierre.totalEfectivo)}
                    </td>
                    <td className="text-right text-primary-600">
                      {formatCurrency(cierre.totalTarjeta)}
                    </td>
                    <td className="text-right text-warning-600">
                      {formatCurrency(cierre.totalMP)}
                    </td>
                    <td className="text-right text-purple-600">
                      {parseFloat(cierre.totalPropinas || 0) > 0 ? formatCurrency(cierre.totalPropinas) : '-'}
                    </td>
                    <td className={`text-right font-medium ${
                      cierre.diferencia === null ? 'text-text-tertiary' :
                      parseFloat(cierre.diferencia) === 0 ? 'text-success-600' :
                      parseFloat(cierre.diferencia) > 0 ? 'text-info-600' : 'text-error-600'
                    }`}>
                      {cierre.diferencia !== null ? formatCurrency(cierre.diferencia) : '-'}
                    </td>
                    <td className="text-center">
                      {cierre.estado === 'CERRADO' ? (
                        <span className="badge badge-info">
                          <CheckCircleIcon className="w-3 h-3 mr-1" />
                          Cerrado
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          <ClockIcon className="w-3 h-3 mr-1" />
                          Abierto
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Abrir Caja */}
      {showAbrirModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="text-heading-3 mb-4">Abrir Caja</h3>
            <form onSubmit={abrirCaja}>
              <div className="mb-4">
                <label className="label" htmlFor="caja-fondo-inicial">
                  Fondo Inicial (efectivo en caja)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                  <input
                    id="caja-fondo-inicial"
                    type="number"
                    step="0.01"
                    min="0"
                    value={fondoInicial}
                    onChange={(e) => setFondoInicial(e.target.value)}
                    className="input pl-8"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAbrirModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Abrir Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        shortcuts={shortcutsList}
        pageName="Cierre de Caja"
      />

      {/* Modal Cerrar Caja */}
      {showCerrarModal && resumen && (
        <div className="modal-overlay">
          <div className="modal max-w-lg">
            <h3 className="text-heading-3 mb-4">Cerrar Caja</h3>

            {/* Resumen de ventas */}
            <div className="bg-surface-hover rounded-xl p-4 mb-4">
              <h4 className="font-medium text-text-primary mb-3">Resumen del Turno</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Fondo Inicial:</span>
                  <span className="font-medium text-text-primary">{formatCurrency(resumen.fondoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Ventas Efectivo:</span>
                  <span className="font-medium text-success-600">{formatCurrency(resumen.ventasEfectivo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Ventas Tarjeta:</span>
                  <span className="font-medium text-primary-600">{formatCurrency(resumen.ventasTarjeta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Ventas MercadoPago:</span>
                  <span className="font-medium text-warning-600">{formatCurrency(resumen.ventasMercadoPago)}</span>
                </div>
                {resumen.ventasPropinas > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Propinas:</span>
                    <span className="font-medium text-purple-600">{formatCurrency(resumen.ventasPropinas)}</span>
                  </div>
                )}
                <hr className="border-border-default my-2" />
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Ventas:</span>
                  <span className="font-bold text-text-primary">{formatCurrency(resumen.totalVentas)}</span>
                </div>
                <div className="flex justify-between bg-info-100 p-2 rounded-lg -mx-2">
                  <span className="text-info-700 font-medium">Efectivo Esperado:</span>
                  <span className="font-bold text-info-700">{formatCurrency(resumen.efectivoEsperado)}</span>
                </div>
                {resumen.propinas?.total > 0 && (
                  <div className="bg-purple-50 p-3 rounded-lg -mx-2 mt-2">
                    <p className="text-purple-700 font-medium text-sm mb-1">Reparto de Propinas</p>
                    <p className="text-purple-600 text-sm">
                      {formatCurrency(resumen.propinas.total)} entre {resumen.propinas.mozosDelTurno} mozo{resumen.propinas.mozosDelTurno !== 1 ? 's' : ''}
                      {resumen.propinas.mozosDelTurno > 0 && (
                        <span className="font-medium"> = {formatCurrency(resumen.propinas.estimadoPorMozo)} c/u</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={cerrarCaja}>
              <div className="mb-4">
                <label className="label" htmlFor="caja-efectivo-contado">
                  Efectivo Contado (en caja)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                  <input
                    id="caja-efectivo-contado"
                    type="number"
                    step="0.01"
                    min="0"
                    value={efectivoFisico}
                    onChange={(e) => setEfectivoFisico(e.target.value)}
                    className="input pl-8"
                    placeholder="0.00"
                    autoFocus
                    required
                  />
                </div>
                {efectivoFisico && (
                  <p className={`mt-1 text-sm ${
                    parseFloat(efectivoFisico) - resumen.efectivoEsperado === 0 ? 'text-success-600' :
                    parseFloat(efectivoFisico) - resumen.efectivoEsperado > 0 ? 'text-info-600' : 'text-error-600'
                  }`}>
                    Diferencia: {formatCurrency(parseFloat(efectivoFisico) - resumen.efectivoEsperado)}
                    {parseFloat(efectivoFisico) - resumen.efectivoEsperado === 0 && ' (Cuadra perfecto)'}
                    {parseFloat(efectivoFisico) - resumen.efectivoEsperado > 0 && ' (Sobrante)'}
                    {parseFloat(efectivoFisico) - resumen.efectivoEsperado < 0 && ' (Faltante)'}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="label" htmlFor="caja-observaciones">
                  Observaciones (opcional)
                </label>
                <textarea
                  id="caja-observaciones"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="input"
                  rows="2"
                  placeholder="Notas sobre el cierre..."
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowCerrarModal(false)
                    setResumen(null)
                  }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirmar Cierre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
