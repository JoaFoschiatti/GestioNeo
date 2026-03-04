import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import useAsync from '../../hooks/useAsync'
import {
  BuildingLibraryIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  LinkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

export default function Transferencias() {
  const [transferencias, setTransferencias] = useState([])
  const [totales, setTotales] = useState({})
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    estado: ''
  })
  const [showFiltros, setShowFiltros] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  // Estado para modal de match manual
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [selectedTransferencia, setSelectedTransferencia] = useState(null)
  const [candidatos, setCandidatos] = useState([])
  const [loadingCandidatos, setLoadingCandidatos] = useState(false)
  const [matchingPedido, setMatchingPedido] = useState(null)

  // Estado para sincronización
  const [syncing, setSyncing] = useState(false)

  const debouncedFiltros = useDebouncedValue(filtros, 300)

  const cargarTransferencias = useCallback(async () => {
    const response = await api.get('/transferencias', {
      params: {
        page: pagination.page,
        limit: 20,
        ...(debouncedFiltros.desde ? { desde: debouncedFiltros.desde } : {}),
        ...(debouncedFiltros.hasta ? { hasta: debouncedFiltros.hasta } : {}),
        ...(debouncedFiltros.estado ? { estado: debouncedFiltros.estado } : {})
      },
      skipToast: true
    })

    const data = response.data
    setTransferencias(data.transferencias || [])
    setTotales(data.totales || {})
    setPagination(data.pagination || { page: 1, pages: 1, total: 0 })
    setErrorMessage(null)
    return data
  }, [debouncedFiltros, pagination.page])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    setErrorMessage(error.response?.data?.error?.message || 'Error al cargar transferencias')
  }, [])

  const cargarTransferenciasRequest = useCallback(async (_ctx) => (
    cargarTransferencias()
  ), [cargarTransferencias])

  const { loading, execute: cargarTransferenciasAsync } = useAsync(
    cargarTransferenciasRequest,
    { onError: handleLoadError }
  )

  // Efecto para cargar datos iniciales
  useEffect(() => {
    cargarTransferenciasAsync()
  }, [debouncedFiltros, pagination.page, cargarTransferenciasAsync])

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

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'MATCHED':
        return (
          <span className="badge badge-success">
            <CheckCircleIcon className="w-3 h-3" />
            Asociada
          </span>
        )
      case 'MANUAL':
        return (
          <span className="badge badge-info">
            <LinkIcon className="w-3 h-3" />
            Manual
          </span>
        )
      case 'RECHAZADA':
        return (
          <span className="badge badge-error">
            <XCircleIcon className="w-3 h-3" />
            Rechazada
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

  // Sincronizar con MercadoPago
  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await api.post('/transferencias/sync')
      const { nuevas, procesadas } = response.data
      alert(`Sincronizacion completada: ${nuevas} nuevas transferencias, ${procesadas} procesadas`)
      cargarTransferenciasAsync()
    } catch (error) {
      console.error('Error al sincronizar:', error)
      alert('Error al sincronizar con MercadoPago')
    } finally {
      setSyncing(false)
    }
  }

  // Abrir modal de match manual
  const handleOpenMatchModal = async (transferencia) => {
    setSelectedTransferencia(transferencia)
    setShowMatchModal(true)
    setLoadingCandidatos(true)

    try {
      const response = await api.get(`/transferencias/${transferencia.id}/candidatos`)
      setCandidatos(response.data.candidatos || [])
    } catch (error) {
      console.error('Error al cargar candidatos:', error)
      setCandidatos([])
    } finally {
      setLoadingCandidatos(false)
    }
  }

  // Ejecutar match manual
  const handleMatch = async (pedidoId) => {
    setMatchingPedido(pedidoId)
    try {
      await api.post(`/transferencias/${selectedTransferencia.id}/match`, { pedidoId })
      setShowMatchModal(false)
      setSelectedTransferencia(null)
      cargarTransferenciasAsync()
    } catch (error) {
      console.error('Error al hacer match:', error)
      alert(error.response?.data?.error || 'Error al asociar transferencia')
    } finally {
      setMatchingPedido(null)
    }
  }

  // Rechazar transferencia
  const handleRechazar = async (transferenciaId) => {
    if (!confirm('¿Rechazar esta transferencia? No se asociara a ningun pedido.')) return

    try {
      await api.post(`/transferencias/${transferenciaId}/rechazar`, {
        motivo: 'Rechazada manualmente por administrador'
      })
      cargarTransferenciasAsync()
    } catch (error) {
      console.error('Error al rechazar:', error)
      alert('Error al rechazar transferencia')
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 flex items-center gap-2">
          <BuildingLibraryIcon className="w-7 h-7 text-primary-500" />
          Transferencias Entrantes
        </h1>

        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar con MP'}
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
              value={filtros.desde}
              onChange={(e) => updateFiltros({ ...filtros, desde: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-sm">Hasta</label>
            <input
              type="date"
              className="input input-sm"
              value={filtros.hasta}
              onChange={(e) => updateFiltros({ ...filtros, hasta: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-sm">Estado</label>
            <select
              className="input input-sm"
              value={filtros.estado}
              onChange={(e) => updateFiltros({ ...filtros, estado: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="MATCHED">Asociada</option>
              <option value="MANUAL">Manual</option>
              <option value="RECHAZADA">Rechazada</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => updateFiltros({ desde: '', hasta: '', estado: '' })}
              className="btn btn-ghost btn-sm"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Estadísticas */}
      {Object.keys(totales).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4 text-center">
            <p className="text-text-tertiary text-sm">Pendientes</p>
            <p className="text-2xl font-bold text-warning-600">
              {totales.PENDIENTE?.count || 0}
            </p>
            <p className="text-xs text-text-tertiary">
              {formatMoney(totales.PENDIENTE?.monto || 0)}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-text-tertiary text-sm">Asociadas</p>
            <p className="text-2xl font-bold text-success-600">
              {(totales.MATCHED?.count || 0) + (totales.MANUAL?.count || 0)}
            </p>
            <p className="text-xs text-text-tertiary">
              {formatMoney((parseFloat(totales.MATCHED?.monto) || 0) + (parseFloat(totales.MANUAL?.monto) || 0))}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-text-tertiary text-sm">Rechazadas</p>
            <p className="text-2xl font-bold text-error-600">
              {totales.RECHAZADA?.count || 0}
            </p>
            <p className="text-xs text-text-tertiary">
              {formatMoney(totales.RECHAZADA?.monto || 0)}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-text-tertiary text-sm">Total</p>
            <p className="text-2xl font-bold text-text-primary">
              {pagination.total}
            </p>
            <p className="text-xs text-text-tertiary">transferencias</p>
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
      {loading && (
        <div className="card p-8 text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-primary-500" />
          <p className="mt-2 text-text-secondary">Cargando transferencias...</p>
        </div>
      )}

      {/* Lista vacía */}
      {!loading && transferencias.length === 0 && (
        <div className="card p-8 text-center">
          <BuildingLibraryIcon className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
          <p className="text-text-secondary">No hay transferencias registradas</p>
          <button
            onClick={handleSync}
            className="btn btn-primary mt-4"
          >
            Sincronizar con MercadoPago
          </button>
        </div>
      )}

      {/* Lista de transferencias */}
      {!loading && transferencias.length > 0 && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pagador</th>
                <th>Concepto</th>
                <th className="text-right">Monto</th>
                <th>Estado</th>
                <th>Pedido</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transferencias.map((t) => (
                <tr key={t.id} className={t.estado === 'PENDIENTE' ? 'bg-warning-50' : ''}>
                  <td className="text-sm">
                    {formatDate(t.createdAt)}
                  </td>
                  <td>
                    <div>
                      <p className="font-medium text-sm">{t.payerName || 'Sin nombre'}</p>
                      {t.payerEmail && (
                        <p className="text-xs text-text-tertiary">{t.payerEmail}</p>
                      )}
                    </div>
                  </td>
                  <td className="max-w-xs truncate text-sm text-text-secondary">
                    {t.concept || '-'}
                  </td>
                  <td className="text-right font-semibold">
                    {formatMoney(t.amount)}
                  </td>
                  <td>{getEstadoBadge(t.estado)}</td>
                  <td>
                    {t.pedido ? (
                      <Link
                        to={`/admin/pedidos?id=${t.pedido.id}`}
                        className="text-primary-600 hover:underline text-sm"
                      >
                        #{t.pedido.id}
                      </Link>
                    ) : (
                      <span className="text-text-tertiary text-sm">-</span>
                    )}
                  </td>
                  <td>
                    {t.estado === 'PENDIENTE' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenMatchModal(t)}
                          className="btn btn-sm btn-primary"
                          title="Asociar a pedido"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRechazar(t.id)}
                          className="btn btn-sm btn-ghost text-error-600"
                          title="Rechazar"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginación */}
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
                Pagina {pagination.page} de {pagination.pages}
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

      {/* Modal de Match Manual */}
      {showMatchModal && selectedTransferencia && (
        <div className="modal-backdrop" onClick={() => setShowMatchModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">Asociar Transferencia a Pedido</h2>
              <button onClick={() => setShowMatchModal(false)} className="btn btn-ghost btn-sm">
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* Info de la transferencia */}
              <div className="bg-surface-hover rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-text-tertiary">Transferencia</p>
                    <p className="font-semibold">{formatMoney(selectedTransferencia.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-tertiary">De</p>
                    <p className="font-medium">{selectedTransferencia.payerName || 'Sin nombre'}</p>
                  </div>
                </div>
                {selectedTransferencia.concept && (
                  <div className="mt-2 pt-2 border-t border-border-default">
                    <p className="text-sm text-text-tertiary">Concepto</p>
                    <p className="text-sm">{selectedTransferencia.concept}</p>
                  </div>
                )}
              </div>

              {/* Loading candidatos */}
              {loadingCandidatos && (
                <div className="text-center py-8">
                  <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto text-primary-500" />
                  <p className="text-sm text-text-secondary mt-2">Buscando pedidos...</p>
                </div>
              )}

              {/* Lista de candidatos */}
              {!loadingCandidatos && candidatos.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {candidatos.map(({ pedido, score, reasons }) => (
                    <div
                      key={pedido.id}
                      className={`p-3 rounded-lg border ${
                        score >= 0.5 ? 'border-success-300 bg-success-50' : 'border-border-default'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            Pedido #{pedido.id}
                            {score >= 0.5 && (
                              <span className="ml-2 text-xs text-success-600">(Sugerido)</span>
                            )}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {pedido.clienteNombre} - {formatMoney(pedido.total)}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {formatDate(pedido.createdAt)}
                          </p>
                          {reasons.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {reasons.map((r, i) => (
                                <span key={i} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleMatch(pedido.id)}
                          disabled={matchingPedido === pedido.id}
                          className="btn btn-sm btn-primary"
                        >
                          {matchingPedido === pedido.id ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            'Asociar'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sin candidatos */}
              {!loadingCandidatos && candidatos.length === 0 && (
                <div className="text-center py-8">
                  <ExclamationTriangleIcon className="w-10 h-10 mx-auto text-warning-500 mb-2" />
                  <p className="text-text-secondary">No se encontraron pedidos pendientes</p>
                  <p className="text-sm text-text-tertiary">
                    Verifica que existan pedidos con metodo de pago TRANSFERENCIA
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
