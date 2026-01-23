import { useCallback, useEffect, useMemo, useRef } from 'react'

export default function useTimeout() {
  const timeoutRef = useRef(null)

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const set = useCallback((callback, delayMs) => {
    clear()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      callback()
    }, delayMs)
  }, [clear])

  useEffect(() => clear, [clear])

  return useMemo(() => ({ set, clear }), [set, clear])
}
