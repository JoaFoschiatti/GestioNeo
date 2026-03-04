import { useEffect, useRef } from 'react'
import { createEventSource } from '../services/eventos'
import useOfflineStatus from './useOfflineStatus'

/**
 * Hook para conectarse a Server-Sent Events (SSE) con reconexión automática.
 *
 * Características de resiliencia:
 * - Backoff exponencial en reconexión (1s, 2s, 4s, 8s, 16s, cap 30s)
 * - Pausa reconexión cuando offline, reconecta inmediato al volver online
 * - Reset del backoff cuando la conexión se establece exitosamente
 *
 * @param {Object} options
 * @param {boolean} [options.enabled=true]
 * @param {Object} options.events - Mapa de nombre de evento → handler
 * @param {Function} [options.onOpen]
 * @param {Function} [options.onError]
 */
export default function useEventSource({ enabled = true, events = {}, onOpen, onError } = {}) {
  const eventsRef = useRef(events)
  const onOpenRef = useRef(onOpen)
  const onErrorRef = useRef(onError)
  const { isOnline } = useOfflineStatus()

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const eventNamesKey = Object.keys(events).sort().join('|')

  useEffect(() => {
    if (!enabled || !isOnline) return undefined
    let cancelled = false
    let source = null
    let reconnectTimer = null
    let backoffMs = 1000
    const MAX_BACKOFF = 30000

    const connect = () => {
      if (cancelled) return

      Promise.resolve(createEventSource()).then((es) => {
        if (cancelled || !es) return
        source = es

        Object.keys(eventsRef.current).forEach((eventName) => {
          const handler = (event) => {
            const currentHandler = eventsRef.current[eventName]
            if (currentHandler) currentHandler(event)
          }
          source.addEventListener(eventName, handler)
        })

        source.onopen = () => {
          backoffMs = 1000 // Reset backoff on successful connection
          onOpenRef.current?.()
        }

        source.onerror = (err) => {
          onErrorRef.current?.(err)
          // EventSource auto-reconnects, but if it closes we reconnect with backoff
          if (source.readyState === EventSource.CLOSED) {
            source = null
            scheduleReconnect()
          }
        }
      }).catch((err) => {
        if (!cancelled) {
          onErrorRef.current?.(err)
          scheduleReconnect()
        }
      })
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, backoffMs)
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF)
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (source) source.close()
    }
  }, [enabled, isOnline, eventNamesKey])
}
