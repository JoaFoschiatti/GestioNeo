import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function TransaccionesMercadoPago() {
  const [transacciones, setTransacciones] = useState([])
  const [totales, setTotales] = useState({ bruto: 0, comisiones: 0, neto: 0, cantidadAprobadas: 0 })
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    status: ''
  })
  const [showFiltros, setShowFiltros] = useState(false)

  useEffect(() => {
    cargarTransacciones()
  }, [pagination.page, filtros])

  const cargarTransacciones = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20
      })

      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)
      if (filtros.status) params.append('status', filtros.status)

      const response = await fetch(`${API_URL}/mercadopago/transacciones?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Error al cargar transacciones')

      const data = await response.json()
      setTransacciones(data.transacciones)
      setTotales(data.totales)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
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
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircleIcon className="w-3 h-3" />
            Aprobado
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircleIcon className="w-3 h-3" />
            Rechazado
          </span>
        )
      case 'pending':
      case 'in_process':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <ClockIcon className="w-3 h-3" />
            Pendiente
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
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
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCardIcon className="w-7 h-7 text-blue-500" />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
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
                  setFiltros({ desde: '', hasta: '', status: '' })
                  setPagination({ ...pagination, page: 1 })
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
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Total Bruto</p>
              <p className="text-xl font-bold text-blue-900">{formatMoney(totales.bruto)}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500 rounded-lg">
              <ReceiptPercentIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-red-600">Comisiones MP</p>
              <p className="text-xl font-bold text-red-900">{formatMoney(totales.comisiones)}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-green-600">Neto Recibido</p>
              <p className="text-xl font-bold text-green-900">{formatMoney(totales.neto)}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-purple-600">Tx Aprobadas</p>
              <p className="text-xl font-bold text-purple-900">{totales.cantidadAprobadas}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : transacciones.length === 0 ? (
          <div className="text-center py-12">
            <CreditCardIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay transacciones registradas</p>
            <p className="text-sm text-gray-400 mt-1">
              Las transacciones apareceran aqui cuando los clientes paguen con MercadoPago
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pedido</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Comision</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Neto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Metodo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pagador</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transacciones.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {tx.pago?.pedido ? (
                          <Link
                            to={`/admin/pedidos?id=${tx.pago.pedido.id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            #{tx.pago.pedido.id}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatMoney(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        {tx.fee ? `-${formatMoney(tx.fee)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {tx.netAmount ? formatMoney(tx.netAmount) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getPaymentMethodLabel(tx.paymentMethod)}
                        {tx.installments > 1 && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({tx.installments} cuotas)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[150px]">
                        {tx.payerEmail || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
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
                  <span className="px-3 py-1 text-sm">
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
