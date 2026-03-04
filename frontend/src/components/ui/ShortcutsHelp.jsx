import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Modal de ayuda de atajos de teclado.
 *
 * @param {boolean} isOpen - Si el modal está visible
 * @param {Function} onClose - Callback para cerrar
 * @param {Array} shortcuts - [{key: 'N', description: 'Nueva mesa'}, ...]
 * @param {string} pageName - Nombre de la página actual
 */
export default function ShortcutsHelp({ isOpen, onClose, shortcuts = [], pageName = '' }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Atajos de Teclado{pageName ? ` - ${pageName}` : ''}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-text-secondary">{description}</span>
              <kbd className="px-2 py-1 bg-surface-hover border border-border-default rounded text-xs font-mono font-semibold text-text-primary min-w-[2rem] text-center">
                {key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border-default">
          <p className="text-xs text-text-tertiary text-center">
            Presiona <kbd className="px-1.5 py-0.5 bg-surface-hover border border-border-default rounded text-xs font-mono">?</kbd> para abrir/cerrar esta ayuda
          </p>
        </div>
      </div>
    </div>
  )
}
