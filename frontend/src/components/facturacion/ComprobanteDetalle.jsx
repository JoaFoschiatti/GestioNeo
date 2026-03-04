import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PrinterIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'

const ESTADO_CONFIG = {
  AUTORIZADO: { badge: 'badge-success', icon: CheckCircleIcon, label: 'Autorizado' },
  PENDIENTE: { badge: 'badge-warning', icon: ClockIcon, label: 'Pendiente' },
  RECHAZADO: { badge: 'badge-error', icon: ExclamationTriangleIcon, label: 'Rechazado' },
  ERROR: { badge: 'badge-error', icon: ExclamationTriangleIcon, label: 'Error' }
}

const TIPO_LABELS = {
  FACTURA_A: 'Factura A',
  FACTURA_B: 'Factura B',
  FACTURA_C: 'Factura C',
  NOTA_CREDITO_A: 'Nota de Credito A',
  NOTA_CREDITO_B: 'Nota de Credito B',
  NOTA_CREDITO_C: 'Nota de Credito C',
  NOTA_DEBITO_A: 'Nota de Debito A',
  NOTA_DEBITO_B: 'Nota de Debito B',
  NOTA_DEBITO_C: 'Nota de Debito C'
}

export default function ComprobanteDetalle({ comprobante, onClose, onRetry }) {
  if (!comprobante) return null

  const estadoConfig = ESTADO_CONFIG[comprobante.estado] || ESTADO_CONFIG.PENDIENTE
  const EstadoIcon = estadoConfig.icon

  const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS'
    })
  }

  const nroFormateado = `${String(comprobante.puntoVenta).padStart(4, '0')}-${String(comprobante.nroComprobante).padStart(8, '0')}`

  const imprimirComprobante = async () => {
    try {
      await api.post(`/impresion/factura/${comprobante.id}`, {})
    } catch {
      // Silent
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-heading-3">
              {TIPO_LABELS[comprobante.tipoComprobante] || comprobante.tipoComprobante}
            </h2>
            <p className="text-text-secondary text-sm">Nro: {nroFormateado}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${estadoConfig.badge}`}>
              <EstadoIcon className="w-3 h-3" />
              {estadoConfig.label}
            </span>
            <button onClick={onClose} className="btn btn-ghost btn-sm">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Detalles */}
        <div className="space-y-4">
          {/* Fecha y receptor */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-text-tertiary">Fecha</p>
              <p className="text-text-primary font-medium">
                {new Date(comprobante.fechaComprobante).toLocaleDateString('es-AR')}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary">Receptor</p>
              <p className="text-text-primary font-medium">
                {comprobante.clienteNombre || (comprobante.docTipo === 99 ? 'Consumidor Final' : `Doc: ${comprobante.docNro}`)}
              </p>
            </div>
          </div>

          {/* Montos */}
          <div className="bg-surface-hover rounded-xl p-4 space-y-2">
            {parseFloat(comprobante.importeNeto) !== parseFloat(comprobante.importeTotal) && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Neto Gravado</span>
                  <span className="text-text-primary">{formatMoney(comprobante.importeNeto)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">IVA 21%</span>
                  <span className="text-text-primary">{formatMoney(comprobante.importeIva)}</span>
                </div>
                {parseFloat(comprobante.importeExento) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Exento</span>
                    <span className="text-text-primary">{formatMoney(comprobante.importeExento)}</span>
                  </div>
                )}
                <div className="border-t border-border-default pt-2" />
              </>
            )}
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatMoney(comprobante.importeTotal)}</span>
            </div>
          </div>

          {/* CAE */}
          {comprobante.cae && (
            <div className="bg-success-50 rounded-xl p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-success-700 font-medium">CAE</span>
                <span className="text-success-800 font-mono">{comprobante.cae}</span>
              </div>
              {comprobante.caeVencimiento && (
                <div className="flex justify-between text-sm">
                  <span className="text-success-700">Vto. CAE</span>
                  <span className="text-success-800">
                    {new Date(comprobante.caeVencimiento).toLocaleDateString('es-AR')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Observaciones / Errores */}
          {comprobante.observaciones && (
            <div className="bg-warning-50 rounded-xl p-3">
              <p className="text-sm text-warning-700">
                <strong>Observaciones:</strong> {comprobante.observaciones}
              </p>
            </div>
          )}

          {comprobante.errores && (
            <div className="bg-error-50 rounded-xl p-3">
              <p className="text-sm text-error-700">
                <strong>Errores:</strong>{' '}
                {Array.isArray(comprobante.errores)
                  ? comprobante.errores.map(e => `${e.Code}: ${e.Msg}`).join(', ')
                  : JSON.stringify(comprobante.errores)
                }
              </p>
            </div>
          )}

          {/* Pedido */}
          {comprobante.pedidoId && (
            <div className="text-sm text-text-secondary">
              Pedido: <span className="font-medium text-text-primary">#{comprobante.pedidoId}</span>
            </div>
          )}

          {/* QR Data */}
          {comprobante.qrData && (
            <div className="text-center">
              <a
                href={comprobante.qrData}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:underline"
              >
                Ver comprobante en AFIP
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {comprobante.estado === 'ERROR' && onRetry && (
            <button
              onClick={() => onRetry(comprobante.id)}
              className="btn btn-warning flex items-center gap-2 flex-1"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Reintentar
            </button>
          )}
          {comprobante.estado === 'AUTORIZADO' && (
            <button
              onClick={imprimirComprobante}
              className="btn btn-secondary flex items-center gap-2 flex-1"
            >
              <PrinterIcon className="w-5 h-5" />
              Imprimir
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
