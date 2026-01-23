import { useEffect, useRef } from 'react'

export default function usePolling(callback, intervalMs, options = {}) {
  const { immediate = true, enabled = true, onError } = options
  const savedCallback = useRef(callback)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!enabled || intervalMs == null) return undefined
    const invoke = () => {
      try {
        const result = savedCallback.current?.()
        if (result && typeof result.then === 'function') {
          result.catch((err) => {
            if (onErrorRef.current) {
              onErrorRef.current(err)
            } else {
              console.error('Polling error:', err)
            }
          })
        }
      } catch (err) {
        if (onErrorRef.current) {
          onErrorRef.current(err)
        } else {
          console.error('Polling error:', err)
        }
      }
    }

    if (immediate) {
      invoke()
    }
    const id = setInterval(invoke, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, immediate])
}
