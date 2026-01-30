import { forwardRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { HomeIcon, SunIcon } from '@heroicons/react/24/outline'
import MesaChip from './MesaChip'

const ZonaDroppable = forwardRef(function ZonaDroppable({
  zona,
  mesas,
  disabled = false,
  onRotar,
  onQuitar,
  onEditar
}, ref) {
  const { setNodeRef, isOver } = useDroppable({
    id: `zona-${zona}`,
    data: { zona }
  })

  const esExterior = zona === 'Exterior'
  const Icon = esExterior ? SunIcon : HomeIcon

  // Combinar refs
  const combinedRef = (node) => {
    setNodeRef(node)
    if (ref) {
      if (typeof ref === 'function') {
        ref(node)
      } else {
        ref.current = node
      }
    }
  }

  return (
    <div
      ref={combinedRef}
      className={`
        relative rounded-xl border-2 border-dashed transition-colors
        min-h-[500px] lg:min-h-[600px]
        ${isOver ? 'border-primary-400 bg-primary-50/30' : 'border-border-default'}
        ${esExterior
          ? 'bg-gradient-to-br from-sky-50/40 via-emerald-50/20 to-green-50/40'
          : 'bg-gradient-to-br from-slate-50/40 via-stone-50/20 to-zinc-50/40'
        }
      `}
    >
      {/* Header */}
      <div className={`
        absolute top-3 left-3 px-3 py-1.5 rounded-lg text-sm font-medium
        flex items-center gap-2
        ${esExterior
          ? 'bg-sky-100/80 text-sky-700 border border-sky-200'
          : 'bg-slate-100/80 text-slate-700 border border-slate-200'
        }
      `}>
        <Icon className="w-4 h-4" />
        {zona}
      </div>

      {/* Contador */}
      <div className="absolute top-3 right-3 text-xs text-text-tertiary">
        {mesas.length} {mesas.length === 1 ? 'mesa' : 'mesas'}
      </div>

      {/* Mesas posicionadas */}
      {mesas.map((mesa) => (
        <div
          key={mesa.id}
          className="absolute"
          style={{
            left: mesa.posX ?? 50,
            top: mesa.posY ?? 60
          }}
        >
          <MesaChip
            mesa={mesa}
            disabled={disabled}
            showActions={!disabled}
            onRotar={onRotar}
            onQuitar={onQuitar}
            onEditar={onEditar}
          />
        </div>
      ))}

      {/* Placeholder cuando está vacío */}
      {mesas.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-text-tertiary">
            <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Arrastra mesas aquí</p>
            <p className="text-xs mt-1 opacity-60">desde el panel superior</p>
          </div>
        </div>
      )}

      {/* Grid de referencia sutil */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none rounded-xl"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />
    </div>
  )
})

export default ZonaDroppable
