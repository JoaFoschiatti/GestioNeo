import { useEffect, useCallback } from 'react'

const ALPHA_NUM_RE = /[a-z0-9]/

/**
 * Hook reutilizable para atajos de teclado.
 *
 * @param {Object} shortcuts - Mapa de tecla -> handler
 *   Las teclas pueden incluir modificadores: 'ctrl+n', 'shift+g', 'alt+1'
 *   Teclas especiales: 'Escape', 'Enter', 'ArrowUp', etc.
 *   Teclas simples: 'n', 'g', '1', '?'
 * @param {Object} options
 * @param {boolean} options.enabled - Si los atajos están activos (default: true)
 */
export default function useKeyboardShortcuts(shortcuts, { enabled = true } = {}) {
  const handleKeyDown = useCallback((e) => {
    // Ignorar eventos en inputs, textareas, selects y contenido editable
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
      // Solo permitir Escape en inputs
      if (e.key !== 'Escape') return
    }

    for (const [combo, handler] of Object.entries(shortcuts)) {
      const parts = combo.toLowerCase().split('+')
      const key = parts.pop()
      const needsCtrl = parts.includes('ctrl')
      const needsShift = parts.includes('shift')
      const needsAlt = parts.includes('alt')

      const keyMatch = e.key.toLowerCase() === key || e.code.toLowerCase() === key

      // For single non-alpha characters (e.g. '?'), skip shiftKey check
      // because they inherently require Shift on most keyboards
      const isShiftedChar = key.length === 1 && !ALPHA_NUM_RE.test(key)

      if (
        keyMatch &&
        e.ctrlKey === needsCtrl &&
        (isShiftedChar || e.shiftKey === needsShift) &&
        e.altKey === needsAlt
      ) {
        e.preventDefault()
        handler(e)
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
