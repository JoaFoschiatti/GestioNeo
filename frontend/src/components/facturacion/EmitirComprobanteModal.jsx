import { useState } from 'react'
import api from '../../services/api'
import {
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PrinterIcon
} from '@heroicons/react/24/outline'

const TIPO_COMPROBANTE_OPTIONS = [
  { value: 'FACTURA_A', label: 'Factura A', docRequired: true },
  { value: 'FACTURA_B', label: 'Factura B', docRequired: false },
  { value: 'FACTURA_C', label: 'Factura C', docRequired: false }
]

const DOC_TIPO_OPTIONS = [
  { value: 80, label: 'CUIT' },
  { value: 96, label: 'DNI' },
  { value: 99, label: 'Consumidor Final' }
]

export default function EmitirComprobanteModal({ isOpen, onClose, pedido, onSuccess }) {
  const [modo, setModo] = useState('rapido') // 'rapido' | 'detallado'
  const [tipoComprobante, setTipoComprobante] = useState('FACTURA_B')
  const [docTipo, setDocTipo] = useState(99)
  const [docNro, setDocNro] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  if (!isOpen || !pedido) return null

  const resetForm = () => {
    setModo('rapido')
    setTipoComprobante('FACTURA_B')
    setDocTipo(99)
    setDocNro('')
    setClienteNombre('')
    setEmitiendo(false)
    setResultado(null)
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const emitirConsumidorFinal = async () => {
    setEmitiendo(true)
    setError(null)
    try {
      const response = await api.post('/comprobantes/consumidor-final', {
        pedidoId: pedido.id
      }, { skipToast: true })
      setResultado(response.data)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al emitir comprobante')
    } finally {
      setEmitiendo(false)
    }
  }

  const emitirDetallado = async (e) => {
    e.preventDefault()
    setEmitiendo(true)
    setError(null)
    try {
      const response = await api.post('/comprobantes', {
        pedidoId: pedido.id,
        tipoComprobante,
        docTipo,
        docNro: docTipo === 99 ? '0' : docNro,
        clienteNombre: clienteNombre || undefined
      }, { skipToast: true })
      setResultado(response.data)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al emitir comprobante')
    } finally {
      setEmitiendo(false)
    }
  }

  const imprimirComprobante = async () => {
    if (!resultado?.id) return
    try {
      await api.post(`/impresion/factura/${resultado.id}`, {})
    } catch {
      // Silent - print is best effort
    }
  }

  const handleFinish = () => {
    if (onSuccess) onSuccess(resultado)
    handleClose()
  }

  const needsDocNro = tipoComprobante === 'FACTURA_A' || (docTipo !== 99 && docTipo !== 0)

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-heading-3 flex items-center gap-2">
            <DocumentTextIcon className="w-6 h-6" />
            Emitir Comprobante
          </h2>
          <button onClick={handleClose} className="btn btn-ghost btn-sm">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Info del pedido */}
        <div className="bg-surface-hover rounded-xl p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Pedido #{pedido.id}</span>
            <span className="font-bold text-text-primary">
              ${parseFloat(pedido.total).toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* Resultado exitoso */}
        {resultado && (
          <div className="space-y-4">
            <div className="bg-success-50 p-4 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircleIcon className="w-8 h-8 text-success-500" />
                <div>
                  <p className="font-bold text-success-800">Comprobante emitido</p>
                  <p className="text-sm text-success-600">
                    {resultado.tipoComprobante?.replace('_', ' ')} Nro: {String(resultado.puntoVenta).padStart(4, '0')}-{String(resultado.nroComprobante).padStart(8, '0')}
                  </p>
                </div>
              </div>
              {resultado.cae && (
                <div className="space-y-1 text-sm text-success-700">
                  <p><strong>CAE:</strong> {resultado.cae}</p>
                  {resultado.caeVencimiento && (
                    <p><strong>Vto. CAE:</strong> {new Date(resultado.caeVencimiento).toLocaleDateString('es-AR')}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={imprimirComprobante}
                className="btn btn-secondary flex items-center gap-2 flex-1"
              >
                <PrinterIcon className="w-5 h-5" />
                Imprimir
              </button>
              <button
                onClick={handleFinish}
                className="btn btn-primary flex-1"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !resultado && (
          <div className="mb-4 bg-error-50 text-error-700 p-3 rounded-xl flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error al emitir comprobante</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Formulario */}
        {!resultado && (
          <>
            {/* Modo rapido / detallado */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setModo('rapido')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modo === 'rapido'
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                Consumidor Final
              </button>
              <button
                type="button"
                onClick={() => setModo('detallado')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modo === 'detallado'
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                Con datos del cliente
              </button>
            </div>

            {modo === 'rapido' ? (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  Emitir comprobante como Consumidor Final. No se requieren datos del cliente.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn btn-secondary flex-1"
                    disabled={emitiendo}
                  >
                    Omitir
                  </button>
                  <button
                    type="button"
                    onClick={emitirConsumidorFinal}
                    disabled={emitiendo}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {emitiendo ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <DocumentTextIcon className="w-5 h-5" />
                    )}
                    {emitiendo ? 'Emitiendo...' : 'Emitir Consumidor Final'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={emitirDetallado} className="space-y-4">
                <div>
                  <label className="label">Tipo de Comprobante</label>
                  <div className="flex gap-2">
                    {TIPO_COMPROBANTE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setTipoComprobante(opt.value)
                          if (opt.value === 'FACTURA_A') setDocTipo(80)
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          tipoComprobante === opt.value
                            ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
                            : 'bg-surface-hover text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="emit-doc-tipo">Tipo de Documento</label>
                  <select
                    id="emit-doc-tipo"
                    value={docTipo}
                    onChange={(e) => setDocTipo(parseInt(e.target.value, 10))}
                    className="input"
                    disabled={tipoComprobante === 'FACTURA_A'}
                  >
                    {DOC_TIPO_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {tipoComprobante === 'FACTURA_A' && (
                    <p className="text-xs text-text-tertiary mt-1">Factura A requiere CUIT del receptor</p>
                  )}
                </div>

                {needsDocNro && (
                  <div>
                    <label className="label" htmlFor="emit-doc-nro">
                      {docTipo === 80 ? 'CUIT' : 'Numero de Documento'}
                    </label>
                    <input
                      id="emit-doc-nro"
                      type="text"
                      value={docNro}
                      onChange={(e) => setDocNro(e.target.value)}
                      className="input"
                      placeholder={docTipo === 80 ? 'XX-XXXXXXXX-X' : 'Numero'}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="emit-cliente-nombre">
                    Nombre / Razon Social (opcional)
                  </label>
                  <input
                    id="emit-cliente-nombre"
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    className="input"
                    placeholder="Nombre del cliente"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn btn-secondary flex-1"
                    disabled={emitiendo}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={emitiendo || (needsDocNro && !docNro)}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {emitiendo ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <DocumentTextIcon className="w-5 h-5" />
                    )}
                    {emitiendo ? 'Emitiendo...' : 'Emitir Comprobante'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
