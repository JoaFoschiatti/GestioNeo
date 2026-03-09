import { PencilIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Badge } from '../ui'
import { formatStock } from '../../constants/unidades'

export default function IngredientesTable({
  formatFecha,
  getEstadoIngrediente,
  ingredienteEnfocadoId,
  ingredientes,
  onAbrirDescarte,
  onAbrirMovimiento,
  onEdit,
  stockBajo,
}) {
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th>Stock Actual</th>
            <th>Stock Minimo</th>
            <th>Costo Unit.</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ingredientes.map((ingrediente) => {
            const estadoIngrediente = getEstadoIngrediente(ingrediente)
            return (<tr
              key={ingrediente.id}
              id={`ingrediente-row-${ingrediente.id}`}
              className={`
                ${ingrediente.tieneLotesVencidos ? 'bg-warning-50/80' : stockBajo(ingrediente) ? 'bg-error-50' : ''}
                ${
                  ingrediente.id === ingredienteEnfocadoId
                    ? 'ring-2 ring-inset ring-primary-300 bg-primary-50/60'
                    : ''
                }
              `}
            >
              <td className="font-medium text-text-primary">
                <div>{ingrediente.nombre}</div>
                {ingrediente.lotesAlerta?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ingrediente.lotesAlerta.slice(0, 2).map((lote) => (
                      <Badge
                        key={lote.id}
                        variant={lote.estadoLote === 'VENCIDO' ? 'error' : 'warning'}
                        className="text-[11px]"
                      >
                        {lote.codigoLote}{' '}
                        {lote.estadoLote === 'VENCIDO'
                          ? 'vencido'
                          : `vence ${formatFecha(lote.fechaVencimiento)}`}
                      </Badge>
                    ))}
                  </div>
                )}
                {parseFloat(ingrediente.stockNoConsumible || 0) > 0 && (
                  <div className="mt-1 text-xs text-warning-700">
                    No utilizable: {formatStock(ingrediente.stockNoConsumible, ingrediente.unidad)}{' '}
                    {ingrediente.unidad}
                  </div>
                )}
                {ingrediente.tieneLotesVencidos && (
                  <div className="mt-1 text-xs font-medium text-warning-700">
                    Requiere descarte manual
                  </div>
                )}
              </td>
              <td className="text-text-primary">
                {formatStock(ingrediente.stockActual, ingrediente.unidad)} {ingrediente.unidad}
              </td>
              <td className="text-text-secondary">
                {formatStock(ingrediente.stockMinimo, ingrediente.unidad)} {ingrediente.unidad}
              </td>
              <td className="text-text-secondary">
                {ingrediente.costo
                  ? `$${parseFloat(ingrediente.costo).toLocaleString('es-AR')}`
                  : '-'}
              </td>
              <td>
                <Badge variant={estadoIngrediente.variant}>
                  {estadoIngrediente.label}
                </Badge>
              </td>
              <td className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
                {ingrediente.tieneLotesVencidos && (
                  <button
                    aria-label={`Descartar lotes vencidos: ${ingrediente.nombre}`}
                    onClick={() => onAbrirDescarte(ingrediente)}
                    className="table-action-btn table-action-btn--danger"
                    title="Descartar lotes vencidos"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span className="hidden lg:inline">Descartar</span>
                  </button>
                )}
                <button
                  aria-label={`Movimiento de stock: ${ingrediente.nombre}`}
                  onClick={() => onAbrirMovimiento(ingrediente)}
                  className="table-action-btn table-action-btn--success"
                  title="Registrar movimiento"
                >
                  <span className="flex items-center gap-0.5">
                    <ArrowUpIcon className="w-4 h-4" />
                    <ArrowDownIcon className="w-4 h-4" />
                  </span>
                  <span className="hidden lg:inline">Movimiento</span>
                </button>
                <button
                  aria-label={`Editar ingrediente: ${ingrediente.nombre}`}
                  onClick={() => onEdit(ingrediente)}
                  className="table-action-btn table-action-btn--primary"
                  title={`Editar ingrediente ${ingrediente.nombre}`}
                >
                  <PencilIcon className="w-4 h-4" />
                  <span className="hidden lg:inline">Editar</span>
                </button>
                </div>
              </td>
            </tr>)
          })}
        </tbody>
      </table>
    </div>
  )
}
