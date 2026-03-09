import Modal from './Modal'

/**
 * Modal de ayuda de atajos de teclado.
 *
 * @param {boolean} isOpen - Si el modal está visible
 * @param {Function} onClose - Callback para cerrar
 * @param {Array} shortcuts - [{key: 'N', description: 'Nueva mesa'}, ...]
 * @param {string} pageName - Nombre de la página actual
 */
export default function ShortcutsHelp({ isOpen, onClose, shortcuts = [], pageName = '' }) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Atajos de Teclado${pageName ? ` - ${pageName}` : ''}`}
      size="sm"
    >
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
    </Modal>
  )
}
