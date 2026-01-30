import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import useAsync from '../../hooks/useAsync'
import {
  CreditCardIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'

export default function TransaccionesMercadoPago() {
  const [transacciones, setTransacciones] = useState([])
  const [totales, setTotales] = useState({ bruto: 0, comisiones: 0, neto: 0, cantidadAprobadas: 0 })
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    status: ''
  })
  const [showFiltros, setShowFiltros] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const debouncedFiltros = useDebouncedValue(filtros, 300)

  const cargarTransacciones = useCallback(async () => {
    const response = await api.get('/mercadopago/transacciones', {
      params: {
        page: pagination.page,
        limit: 20,
        ...(debouncedFiltros.desde ? { desde: debouncedFiltros.desde } : {}),
        ...(debouncedFiltros.hasta ? { hasta: debouncedFiltros.hasta } : {}),
        ...(debouncedFiltros.status ? { status: debouncedFiltros.status } : {})
      },
      skipToast: true
    })

    const data = response.data
    setTransacciones(data.transacciones || [])
    setTotales(data.totales || { bruto: 0, comisiones: 0, neto: 0, cantidadAprobadas: 0 })
    setPagination(data.pagination || { page: 1, pages: 1, total: 0 })
    setErrorMessage(null)
    return data
  }, [debouncedFiltros, pagination.page])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    setErrorMessage(error.response?.data?.error?.message || 'Error al cargar transacciones')
  }, [])

  const cargarTransaccionesRequest = useCallback(async (_ctx) => (
    cargarTransacciones()
  ), [cargarTransacciones])

  const { loading, execute: cargarTransaccionesAsync } = useAsync(
    cargarTransaccionesRequest,
    { onError: handleLoadError }
  )

  const updateFiltros = (next) => {
    setFiltros(prev => (typeof next === 'function' ? next(prev) : next))
    setPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }))
  }

  const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS'
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badge badge-success">
            <CheckCircleIcon className="w-3 h-3" />
            Aprobado
          </span>
        )
      case 'rejected':
        return (
          <span className="badge badge-error">
            <XCircleIcon className="w-3 h-3" />
            Rechazado
          </span>
        )
      case 'pending':
      case 'in_process':
        return (
          <span className="badge badge-warning">
            <ClockIcon className="w-3 h-3" />
            Pendiente
          </span>
        )
      default:
        return (
          <span className="badge">
            {status}
          </span>
        )
    }
  }

  const getPaymentMethodLabel = (method) => {
    const methods = {
      'credit_card': 'Tarjeta de Credito',
      'debit_card': 'Tarjeta de Debito',
      'account_money': 'Dinero en Cuenta',
      'ticket': 'Pago Facil / Rapipago',
      'bank_transfer': 'Transferencia'
    }
    return methods[method] || method || '-'
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 flex items-center gap-2">
          <CreditCardIcon className="w-7 h-7 text-info-500" />
          Transacciones MercadoPago
        </h1>

        <button
          onClick={() => setShowFiltros(!showFiltros)}
          className={`btn ${showFiltros ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
        >
          <FunnelIcon className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {/* Filtros */}
      {showFiltros && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label" htmlFor="tx-desde">Desde</label>
              <input
                id="tx-desde"
                type="date"
                value={filtros.desde}
                onChange={(e) => updateFiltros(prev => ({ ...prev, desde: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="tx-hasta">Hasta</label>
              <input
                id="tx-hasta"
                type="date"
                value={filtros.hasta}
                onChange={(e) => updateFiltros(prev => ({ ...prev, hasta: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="tx-estado">Estado</label>
              <select
                id="tx-estado"
                value={filtros.status}
                onChange={(e) => updateFiltros(prev => ({ ...prev, status: e.target.value }))}
                className="input"
              >
                <option value="">Todos</option>
                <option value="approved">Aprobados</option>
                <option value="rejected">Rechazados</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  updateFiltros({ desde: '', hasta: '', status: '' })
                }}
                className="btn btn-secondary w-full"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-info-500 rounded-xl">
              <BanknotesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Total Bruto</p>
              <p className="text-xl font-bold text-text-primary">{formatMoney(totales.bruto)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-error-500 rounded-xl">
              <ReceiptPercentIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Comisiones MP</p>
              <p className="text-xl font-bold text-text-primary">{formatMoney(totales.comisiones)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-success-500 rounded-xl">
              <CurrencyDollarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Neto Recibido</p>
              <p className="text-xl font-bold text-text-primary">{formatMoney(totales.neto)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500 rounded-xl">
              <CheckCircleIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Tx Aprobadas</p>
              <p className="text-xl font-bold text-text-primary">{totales.cantidadAprobadas}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner spinner-lg" />
          </div>
        ) : errorMessage ? (
          <div className="text-center py-12">
            <XCircleIcon className="w-16 h-16 text-error-300 mx-auto mb-4" />
            <p className="text-error-600">{errorMessage}</p>
            <button
              onClick={cargarTransaccionesAsync}
              className="mt-4 btn btn-secondary"
            >
              Reintentar
            </button>
          </div>
        ) : transacciones.length === 0 ? (
          <div className="text-center py-12">
            <CreditCardIcon className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary">No hay transacciones registradas</p>
            <p className="text-sm text-text-tertiary mt-1">
              Las transacciones apareceran aqui cuando los clientes paguen con MercadoPago
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedido</th>
                    <th>Monto</th>
                    <th>Comision</th>
                    <th>Neto</th>
                    <th>Estado</th>
                    <th>Metodo</th>
                    <th>Pagador</th>
                  </tr>
                </thead>
                <tbody>
                  {transacciones.map((tx) => (
                    <tr key={tx.id}>
                      <td className="text-text-secondary">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td>
                        {tx.pago?.pedido ? (
                          <Link
                            to={`/admin/pedidos?id=${tx.pago.pedido.id}`}
                            className="text-primary-600 hover:underline font-medium"
                          >
                            #{tx.pago.pedido.id}
                          </Link>
                        ) : (
                          <span className="text-text-tertiary">-</span>
                        )}
                      </td>
                      <td className="font-medium text-text-primary">
                        {formatMoney(tx.amount)}
                      </td>
                      <td className="text-error-600">
                        {tx.fee ? `-${formatMoney(tx.fee)}` : '-'}
                      </td>
                      <td className="font-medium text-success-600">
                        {tx.netAmount ? formatMoney(tx.netAmount) : '-'}
                      </td>
                      <td>
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="text-text-secondary">
                        {getPaymentMethodLabel(tx.paymentMethod)}
                        {tx.installments > 1 && (
                          <span className="text-xs text-text-tertiary ml-1">
                            ({tx.installments} cuotas)
                          </span>
                        )}
                      </td>
                      <td className="text-text-tertiary truncate max-w-[150px]">
                        {tx.payerEmail || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-default bg-surface-hover">
                <p className="text-sm text-text-secondary">
                  Mostrando {transacciones.length} de {pagination.total} transacciones
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="btn btn-secondary btn-sm disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-1 text-sm text-text-primary">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.pages}
                    className="btn btn-secondary btn-sm disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
