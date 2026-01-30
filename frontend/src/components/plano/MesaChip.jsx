import { useDraggable } from '@dnd-kit/core'
import { ArrowPathIcon, XMarkIcon, PencilIcon } from '@heroicons/react/20/solid'

const getEstadoClasses = (estado) => {
  switch (estado) {
    case 'LIBRE':
      return 'bg-success-50 border-success-300 text-success-700'
    case 'OCUPADA':
      return 'bg-error-50 border-error-300 text-error-700'
    case 'RESERVADA':
      return 'bg-warning-50 border-warning-300 text-warning-700'
    default:
      return 'bg-surface border-border-default text-text-primary'
  }
}

// Determinar tamaño según capacidad
const getTamanio = (capacidad) => {
  if (capacidad >= 6) {
    return { width: 100, height: 48 } // Rectangular alargado para 6+ personas
  }
  return { width: 56, height: 56 } // Cuadrado para 4 personas o menos
}

export default function MesaChip({
  mesa,
  disabled = false,
  isDragging = false,
  onRotar,
  onQuitar,
  onEditar,
  showActions = false
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `mesa-${mesa.id}`,
    data: { mesa },
    disabled
  })

  const tamanio = getTamanio(mesa.capacidad)
  const estadoClasses = getEstadoClasses(mesa.estado)
  const rotacion = mesa.rotacion || 0
  const esRectangular = mesa.capacidad >= 6

  // Calcular dimensiones rotadas para el contenedor
  const esRotado90o270 = rotacion === 90 || rotacion === 270
  const containerWidth = esRotado90o270 ? tamanio.height : tamanio.width
  const containerHeight = esRotado90o270 ? tamanio.width : tamanio.height

  const style = {
    width: containerWidth,
    height: containerHeight,
    ...(transform && {
      transform: `translate(${transform.x}px, ${transform.y}px)`,
      zIndex: 1000
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      {/* Botones de acción */}
      {showActions && !disabled && !isDragging && (
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {onEditar && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditar(mesa)
              }}
              className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center hover:bg-slate-700 shadow-sm"
              title="Editar mesa"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
          )}
          {esRectangular && onRotar && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRotar(mesa.id)
              }}
              className="w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 shadow-sm"
              title="Rotar mesa"
            >
              <ArrowPathIcon className="w-3 h-3" />
            </button>
          )}
          {onQuitar && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onQuitar(mesa.id)
              }}
              className="w-5 h-5 rounded-full bg-error-500 text-white flex items-center justify-center hover:bg-error-600 shadow-sm"
              title="Quitar de la zona"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Mesa */}
      <div
        {...(disabled ? {} : { ...listeners, ...attributes })}
        style={{
          width: tamanio.width,
          height: tamanio.height,
          transform: `rotate(${rotacion}deg)`,
          transformOrigin: 'center center',
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -tamanio.width / 2,
          marginTop: -tamanio.height / 2,
        }}
        className={`
          rounded-xl border-2 flex flex-col items-center justify-center
          shadow-sm select-none transition-shadow
          ${estadoClasses}
          ${isDragging ? 'shadow-xl opacity-95 scale-105' : ''}
          ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:shadow-md'}
        `}
      >
        <span
          className="text-base font-bold leading-none"
          style={{ transform: `rotate(-${rotacion}deg)` }}
        >
          {mesa.numero}
        </span>
        <span
          className="text-[9px] opacity-60 leading-none mt-0.5"
          style={{ transform: `rotate(-${rotacion}deg)` }}
        >
          {mesa.capacidad}p
        </span>
      </div>
    </div>
  )
}
