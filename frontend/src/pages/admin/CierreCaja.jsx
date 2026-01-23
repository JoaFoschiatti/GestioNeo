import { useState, useCallback, useEffect } from 'react'
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

export default function CierreCaja() {
  const [cajaActual, setCajaActual] = useState(null)
  const [historico, setHistorico] = useState([])
  const [showAbrirModal, setShowAbrirModal] = useState(false)
  const [showCerrarModal, setShowCerrarModal] = useState(false)
  const [fondoInicial, setFondoInicial] = useState('')
  const [efectivoFisico, setEfectivoFisico] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [resumen, setResumen] = useState(null)

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
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cierre de Caja</h1>

      {/* Estado actual */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Estado Actual</h2>
          {cajaActual?.cajaAbierta ? (
            <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <LockOpenIcon className="w-4 h-4" />
              Caja Abierta
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
              <LockClosedIcon className="w-4 h-4" />
              Caja Cerrada
            </span>
          )}
        </div>

        {cajaActual?.cajaAbierta ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600">Fondo Inicial</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(cajaActual.caja.fondoInicial)}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600">Ventas Efectivo</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(cajaActual.caja.ventasActuales?.efectivo)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600">Ventas Tarjeta</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(cajaActual.caja.ventasActuales?.tarjeta)}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-600">MercadoPago</p>
                <p className="text-2xl font-bold text-orange-700">
                  {formatCurrency(cajaActual.caja.ventasActuales?.mercadopago)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="text-sm text-gray-500">
                  Abierta por: {cajaActual.caja.usuario?.nombre}
                </p>
                <p className="text-sm text-gray-500">
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
            <BanknotesIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No hay caja abierta</p>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Cierres</h2>

        {historico.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay cierres registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fondo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Efectivo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tarjeta</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">MP</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historico.map((cierre) => (
                  <tr key={cierre.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(cierre.horaApertura)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {cierre.usuario?.nombre}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      {formatCurrency(cierre.fondoInicial)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                      {formatCurrency(cierre.totalEfectivo)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-purple-600">
                      {formatCurrency(cierre.totalTarjeta)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-600">
                      {formatCurrency(cierre.totalMP)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                      cierre.diferencia === null ? 'text-gray-400' :
                      parseFloat(cierre.diferencia) === 0 ? 'text-green-600' :
                      parseFloat(cierre.diferencia) > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {cierre.diferencia !== null ? formatCurrency(cierre.diferencia) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {cierre.estado === 'CERRADO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          <CheckCircleIcon className="w-3 h-3" />
                          Cerrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-600 rounded text-xs">
                          <ClockIcon className="w-3 h-3" />
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
	        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
	            <h3 className="text-lg font-semibold text-gray-900 mb-4">Abrir Caja</h3>
	            <form onSubmit={abrirCaja}>
	              <div className="mb-4">
	                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="caja-fondo-inicial">
	                  Fondo Inicial (efectivo en caja)
	                </label>
	                <div className="relative">
	                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
              <div className="flex gap-3 justify-end">
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

      {/* Modal Cerrar Caja */}
      {showCerrarModal && resumen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cerrar Caja</h3>

            {/* Resumen de ventas */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-700 mb-3">Resumen del Turno</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fondo Inicial:</span>
                  <span className="font-medium">{formatCurrency(resumen.fondoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ventas Efectivo:</span>
                  <span className="font-medium text-green-600">{formatCurrency(resumen.ventasEfectivo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ventas Tarjeta:</span>
                  <span className="font-medium text-purple-600">{formatCurrency(resumen.ventasTarjeta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ventas MercadoPago:</span>
                  <span className="font-medium text-orange-600">{formatCurrency(resumen.ventasMercadoPago)}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Ventas:</span>
                  <span className="font-bold">{formatCurrency(resumen.totalVentas)}</span>
                </div>
                <div className="flex justify-between bg-blue-100 p-2 rounded -mx-2">
                  <span className="text-blue-700 font-medium">Efectivo Esperado:</span>
                  <span className="font-bold text-blue-700">{formatCurrency(resumen.efectivoEsperado)}</span>
                </div>
              </div>
            </div>

	            <form onSubmit={cerrarCaja}>
	              <div className="mb-4">
	                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="caja-efectivo-contado">
	                  Efectivo Contado (en caja)
	                </label>
	                <div className="relative">
	                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
                    parseFloat(efectivoFisico) - resumen.efectivoEsperado === 0 ? 'text-green-600' :
                    parseFloat(efectivoFisico) - resumen.efectivoEsperado > 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    Diferencia: {formatCurrency(parseFloat(efectivoFisico) - resumen.efectivoEsperado)}
                    {parseFloat(efectivoFisico) - resumen.efectivoEsperado === 0 && ' (Cuadra perfecto)'}
                    {parseFloat(efectivoFisico) - resumen.efectivoEsperado > 0 && ' (Sobrante)'}
                    {parseFloat(efectivoFisico) - resumen.efectivoEsperado < 0 && ' (Faltante)'}
                  </p>
                )}
              </div>

	              <div className="mb-4">
	                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="caja-observaciones">
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

              <div className="flex gap-3 justify-end">
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
