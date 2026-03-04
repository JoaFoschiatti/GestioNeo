import { useState, useCallback, useEffect } from 'react'
import api from '../../services/api'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import useAsync from '../../hooks/useAsync'
import ComprobanteDetalle from '../../components/facturacion/ComprobanteDetalle'
import {
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'

const TIPO_LABELS = {
  FACTURA_A: 'Factura A',
  FACTURA_B: 'Factura B',
  FACTURA_C: 'Factura C',
  NOTA_CREDITO_A: 'NC A',
  NOTA_CREDITO_B: 'NC B',
  NOTA_CREDITO_C: 'NC C',
  NOTA_DEBITO_A: 'ND A',
  NOTA_DEBITO_B: 'ND B',
  NOTA_DEBITO_C: 'ND C'
}

export default function Comprobantes() {
  const [comprobantes, setComprobantes] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    tipo: '',
    estado: ''
  })
  const [showFiltros, setShowFiltros] = useState(false)
  const [selectedComprobante, setSelectedComprobante] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const debouncedFiltros = useDebouncedValue(filtros, 300)

  const cargarComprobantes = useCallback(async () => {
    const params = {
      page: pagination.page,
      limit: 20,
      ...(debouncedFiltros.fechaDesde ? { fechaDesde: debouncedFiltros.fechaDesde } : {}),
      ...(debouncedFiltros.fechaHasta ? { fechaHasta: debouncedFiltros.fechaHasta } : {}),
      ...(debouncedFiltros.tipo ? { tipo: debouncedFiltros.tipo } : {}),
      ...(debouncedFiltros.estado ? { estado: debouncedFiltros.estado } : {})
    }

    const response = await api.get('/comprobantes', { params, skipToast: true })
    const data = response.data
    setComprobantes(data.comprobantes || [])
    setPagination(data.pagination || { page: 1, pages: 1, total: 0 })
    setErrorMessage(null)
    return data
  }, [debouncedFiltros, pagination.page])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    setErrorMessage(error.response?.data?.error?.message || 'Error al cargar comprobantes')
  }, [])

  const cargarComprobantesRequest = useCallback(async (_ctx) => (
    cargarComprobantes()
  ), [cargarComprobantes])

  const { loading, execute: cargarComprobantesAsync } = useAsync(
    cargarComprobantesRequest,
    { onError: handleLoadError }
  )

  useEffect(() => {
    cargarComprobantesAsync()
  }, [debouncedFiltros, pagination.page, cargarComprobantesAsync])

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
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'AUTORIZADO':
        return (
          <span className="badge badge-success">
            <CheckCircleIcon className="w-3 h-3" />
            Autorizado
          </span>
        )
      case 'RECHAZADO':
        return (
          <span className="badge badge-error">
            <XCircleIcon className="w-3 h-3" />
            Rechazado
          </span>
        )
      case 'ERROR':
        return (
          <span className="badge badge-error">
            <ExclamationTriangleIcon className="w-3 h-3" />
            Error
          </span>
        )
      case 'PENDIENTE':
      default:
        return (
          <span className="badge badge-warning">
            <ClockIcon className="w-3 h-3" />
            Pendiente
          </span>
        )
    }
  }

  const verDetalle = async (id) => {
    try {
      const response = await api.get(`/comprobantes/${id}`, { skipToast: true })
      setSelectedComprobante(response.data)
    } catch (error) {
      console.error('Error al cargar detalle:', error)
    }
  }

  const reintentar = async (id) => {
    try {
      await api.post(`/comprobantes/${id}/reintentar`, {}, { skipToast: true })
      setSelectedComprobante(null)
      cargarComprobantesAsync()
    } catch (error) {
      console.error('Error al reintentar:', error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 flex items-center gap-2">
          <DocumentTextIcon className="w-7 h-7 text-primary-500" />
          Comprobantes Fiscales
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => cargarComprobantesAsync()}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`btn ${showFiltros ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
          >
            <FunnelIcon className="w-5 h-5" />
            Filtros
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFiltros && (
        <div className="card p-4 mb-6 flex flex-wrap gap-4">
          <div>
            <label className="label text-sm">Desde</label>
            <input
              type="date"
              className="input input-sm"
              value={filtros.fechaDesde}
              onChange={(e) => updateFiltros({ ...filtros, fechaDesde: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-sm">Hasta</label>
            <input
              type="date"
              className="input input-sm"
              value={filtros.fechaHasta}
              onChange={(e) => updateFiltros({ ...filtros, fechaHasta: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-sm">Tipo</label>
            <select
              className="input input-sm"
              value={filtros.tipo}
              onChange={(e) => updateFiltros({ ...filtros, tipo: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="FACTURA_A">Factura A</option>
              <option value="FACTURA_B">Factura B</option>
              <option value="FACTURA_C">Factura C</option>
              <option value="NOTA_CREDITO_A">NC A</option>
              <option value="NOTA_CREDITO_B">NC B</option>
              <option value="NOTA_CREDITO_C">NC C</option>
            </select>
          </div>
          <div>
            <label className="label text-sm">Estado</label>
            <select
              className="input input-sm"
              value={filtros.estado}
              onChange={(e) => updateFiltros({ ...filtros, estado: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="AUTORIZADO">Autorizado</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="RECHAZADO">Rechazado</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => updateFiltros({ fechaDesde: '', fechaHasta: '', tipo: '', estado: '' })}
              className="btn btn-ghost btn-sm"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="bg-error-50 text-error-700 p-4 rounded-lg mb-6">
          {errorMessage}
        </div>
      )}

      {/* Loading */}
      {loading && comprobantes.length === 0 && (
        <div className="card p-8 text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-primary-500" />
          <p className="mt-2 text-text-secondary">Cargando comprobantes...</p>
        </div>
      )}

      {/* Lista vacia */}
      {!loading && comprobantes.length === 0 && (
        <div className="card p-8 text-center">
          <DocumentTextIcon className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
          <p className="text-text-secondary">No hay comprobantes emitidos</p>
          <p className="text-sm text-text-tertiary mt-1">
            Los comprobantes apareceran aqui al emitir facturas desde los pedidos
          </p>
        </div>
      )}

      {/* Tabla */}
      {!loading && comprobantes.length > 0 && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Nro</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th className="text-right">Total</th>
                <th>CAE</th>
                <th>Estado</th>
                <th>Pedido</th>
              </tr>
            </thead>
            <tbody>
              {comprobantes.map((c) => (
                <tr
                  key={c.id}
                  className={`cursor-pointer hover:bg-surface-hover ${c.estado === 'ERROR' ? 'bg-error-50' : ''}`}
                  onClick={() => verDetalle(c.id)}
                >
                  <td className="font-mono text-sm">
                    {String(c.puntoVenta).padStart(4, '0')}-{String(c.nroComprobante).padStart(8, '0')}
                  </td>
                  <td className="text-sm">
                    {formatDate(c.fechaComprobante)}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {TIPO_LABELS[c.tipoComprobante] || c.tipoComprobante}
                    </span>
                  </td>
                  <td className="text-sm text-text-secondary">
                    {c.clienteNombre || (c.docTipo === 99 ? 'Cons. Final' : c.docNro)}
                  </td>
                  <td className="text-right font-semibold">
                    {formatMoney(c.importeTotal)}
                  </td>
                  <td className="font-mono text-xs text-text-tertiary">
                    {c.cae ? `${c.cae.slice(0, 6)}...` : '-'}
                  </td>
                  <td>{getEstadoBadge(c.estado)}</td>
                  <td className="text-sm text-text-secondary">
                    {c.pedidoId ? `#${c.pedidoId}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginacion */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-border-default flex justify-center gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn btn-sm btn-ghost"
              >
                Anterior
              </button>
              <span className="flex items-center text-sm text-text-secondary">
                Pagina {pagination.page} de {pagination.pages} ({pagination.total} total)
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="btn btn-sm btn-ghost"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Detalle */}
      {selectedComprobante && (
        <ComprobanteDetalle
          comprobante={selectedComprobante}
          onClose={() => setSelectedComprobante(null)}
          onRetry={reintentar}
        />
      )}
    </div>
  )
}
