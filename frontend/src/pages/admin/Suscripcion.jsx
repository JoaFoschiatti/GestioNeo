import { useState, useCallback, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import {
  CreditCardIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function Suscripcion() {
  const { suscripcion, modoSoloLectura, refrescarSuscripcion } = useAuth()
  const [estado, setEstado] = useState(null)
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const cargarEstado = useCallback(async () => {
    try {
      // Load estado first
      const estadoRes = await api.get('/suscripcion/estado', { skipToast: true })
      setEstado(estadoRes.data)

      // Then load pagos
      const pagosRes = await api.get('/suscripcion/pagos', { skipToast: true })
      setPagos(pagosRes.data.pagos || [])
    } catch (error) {
      // Don't show error if subscription doesn't exist yet (404) or if no subscription data
      if (error.response?.status === 404 || error.response?.data?.estado === 'SIN_SUSCRIPCION') {
        setEstado(null)
        setPagos([])
      } else {
        console.error('Error cargando suscripcion:', error.response?.data || error.message)
        const message = error.response?.data?.error?.message || 'Error al cargar informacion de suscripcion'
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarEstado()
  }, [cargarEstado])

  const handleSuscribirse = async () => {
    setActionLoading(true)
    try {
      const response = await api.post('/suscripcion/crear', {}, { skipToast: true })
      if (response.data.initPoint) {
        // Redirect to MercadoPago checkout
        window.location.href = response.data.initPoint
      } else {
        toast.success('Suscripcion creada')
        cargarEstado()
        refrescarSuscripcion()
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al crear suscripcion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelar = async () => {
    if (!confirm('¿Estas seguro de cancelar tu suscripcion? Perderas acceso a las funciones de escritura.')) {
      return
    }

    setActionLoading(true)
    try {
      await api.post('/suscripcion/cancelar', {}, { skipToast: true })
      toast.success('Suscripcion cancelada')
      cargarEstado()
      refrescarSuscripcion()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.response?.data?.error?.message || 'Error al cancelar suscripcion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefrescar = async () => {
    setLoading(true)
    await cargarEstado()
    await refrescarSuscripcion()
  }

  const getEstadoBadge = () => {
    const estadoActual = estado?.estado || suscripcion?.estado

    switch (estadoActual) {
      case 'ACTIVA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-700">
            <CheckCircleIcon className="w-4 h-4" />
            Activa
          </span>
        )
      case 'PENDIENTE':
      case 'SIN_SUSCRIPCION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-warning-100 text-warning-700">
            <ClockIcon className="w-4 h-4" />
            Pendiente
          </span>
        )
      case 'MOROSA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-error-100 text-error-700">
            <ExclamationTriangleIcon className="w-4 h-4" />
            Morosa
          </span>
        )
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            <XCircleIcon className="w-4 h-4" />
            Cancelada
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            <ClockIcon className="w-4 h-4" />
            Sin suscripcion
          </span>
        )
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  const estadoActual = estado?.estado || suscripcion?.estado
  const isActive = estadoActual === 'ACTIVA'
  const canSubscribe = !isActive || estadoActual === 'CANCELADA'
  const precioMensual = estado?.precioMensual || suscripcion?.precioMensual || 37000

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Suscripcion</h1>
          <p className="text-text-secondary mt-1">Gestiona tu plan de suscripcion</p>
        </div>
        <button
          onClick={handleRefrescar}
          className="btn btn-ghost"
          disabled={loading}
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Status Card */}
      <div className="card">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary-100">
                  <CreditCardIcon className="w-8 h-8 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Plan Profesional</h2>
                  <p className="text-text-secondary">{formatCurrency(precioMensual)}/mes</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-text-tertiary">Estado</p>
                  {getEstadoBadge()}
                </div>
                {estado?.fechaVencimiento && (
                  <div>
                    <p className="text-sm text-text-tertiary">Vence</p>
                    <p className="text-sm font-medium text-text-primary">
                      {formatDate(estado.fechaVencimiento)}
                    </p>
                  </div>
                )}
                {estado?.fechaProximoCobro && (
                  <div>
                    <p className="text-sm text-text-tertiary">Proximo cobro</p>
                    <p className="text-sm font-medium text-text-primary">
                      {formatDate(estado.fechaProximoCobro)}
                    </p>
                  </div>
                )}
              </div>

              {modoSoloLectura && (
                <div className="p-3 rounded-lg bg-warning-50 border border-warning-200">
                  <p className="text-sm text-warning-700">
                    Estas en modo solo lectura. Activa tu suscripcion para usar todas las funciones.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {canSubscribe && (
                <button
                  onClick={handleSuscribirse}
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <span className="spinner spinner-sm" />
                  ) : (
                    <CreditCardIcon className="w-5 h-5" />
                  )}
                  {isActive ? 'Renovar' : 'Activar suscripcion'}
                </button>
              )}
              {isActive && (
                <button
                  onClick={handleCancelar}
                  className="btn btn-ghost text-error-600 hover:bg-error-50"
                  disabled={actionLoading}
                >
                  Cancelar suscripcion
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Card */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Incluido en tu plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Gestion de mesas y pedidos',
              'Menu digital QR',
              'Reservas online',
              'Control de inventario',
              'Gestion de empleados',
              'Reportes y estadisticas',
              'Integracion MercadoPago',
              'Soporte prioritario'
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-success-500" />
                <span className="text-sm text-text-secondary">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="card">
        <div className="p-6 border-b border-border-subtle">
          <h3 className="text-lg font-semibold text-text-primary">Historial de pagos</h3>
        </div>
        <div className="overflow-x-auto">
          {pagos.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary">
              No hay pagos registrados
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Periodo</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Metodo</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td>{formatDate(pago.createdAt)}</td>
                    <td>
                      {formatDate(pago.periodoInicio)} - {formatDate(pago.periodoFin)}
                    </td>
                    <td>{formatCurrency(pago.monto)}</td>
                    <td>
                      <span className={`badge ${
                        pago.mpStatus === 'approved' ? 'badge-success' :
                        pago.mpStatus === 'pending' ? 'badge-warning' :
                        'badge-error'
                      }`}>
                        {pago.mpStatus === 'approved' ? 'Aprobado' :
                         pago.mpStatus === 'pending' ? 'Pendiente' :
                         pago.mpStatus}
                      </span>
                    </td>
                    <td className="text-text-secondary">{pago.metodoPago || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
