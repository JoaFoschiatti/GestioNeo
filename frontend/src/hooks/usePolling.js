import { useEffect, useRef } from 'react'
import useOfflineStatus from './useOfflineStatus'

export default function usePolling(callback, intervalMs, options = {}) {
  const { immediate = true, enabled = true, onError } = options
  const savedCallback = useRef(callback)
  const onErrorRef = useRef(onError)
  const { isOnline } = useOfflineStatus()

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    // Pause polling when offline to avoid unnecessary errors
    if (!enabled || intervalMs == null || !isOnline) return undefined
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
  }, [enabled, intervalMs, immediate, isOnline])
}
