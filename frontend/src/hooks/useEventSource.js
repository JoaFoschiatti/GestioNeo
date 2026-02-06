import { useEffect, useRef } from 'react'
import { createEventSource } from '../services/eventos'

/**
 * Hook para conectarse a Server-Sent Events (SSE).
 *
 * Comanda usa SSE para actualizaciones en tiempo real:
 * - Nuevos pedidos en cocina
 * - Cambios de estado de mesas
 * - Actualizaciones de pagos
 * - Notificaciones de stock agotado
 *
 * El servidor emite eventos en `/api/eventos` y este hook los escucha.
 *
 * @param {Object} options - Opciones de configuración
 * @param {boolean} [options.enabled=true] - Si debe conectarse (útil para habilitar/deshabilitar)
 * @param {Object} options.events - Mapa de nombre de evento → función handler
 * @param {Function} [options.onOpen] - Callback cuando la conexión se establece
 * @param {Function} [options.onError] - Callback cuando hay error de conexión
 *
 * @returns {void}
 *
 * @example
 * // En la pantalla de cocina
 * useEventSource({
 *   enabled: true,
 *   events: {
 *     'pedido.created': (event) => {
 *       const data = JSON.parse(event.data);
 *       // data = { id: 123, items: [...], mesa: {...} }
 *       setPedidos(prev => [...prev, data]);
 *       playNotificationSound();
 *     },
 *     'pedido.updated': (event) => {
 *       const data = JSON.parse(event.data);
 *       setPedidos(prev => prev.map(p =>
 *         p.id === data.id ? { ...p, estado: data.estado } : p
 *       ));
 *     },
 *     'mesa.updated': (event) => {
 *       const data = JSON.parse(event.data);
 *       setMesas(prev => prev.map(m =>
 *         m.id === data.mesaId ? { ...m, estado: data.estado } : m
 *       ));
 *     }
 *   },
 *   onOpen: () => console.log('Conectado a eventos'),
 *   onError: (err) => console.error('Error SSE:', err)
 * });
 *
 * @example
 * // Habilitar/deshabilitar según estado
 * const [escuchando, setEscuchando] = useState(true);
 *
 * useEventSource({
 *   enabled: escuchando,
 *   events: { ... }
 * });
 *
 * // Botón para pausar notificaciones
 * <button onClick={() => setEscuchando(prev => !prev)}>
 *   {escuchando ? 'Pausar' : 'Reanudar'} notificaciones
 * </button>
 *
 * @see backend/src/services/event-bus.js - Implementación del servidor SSE
 */
export default function useEventSource({ enabled = true, events = {}, onOpen, onError } = {}) {
  const eventsRef = useRef(events)
  const onOpenRef = useRef(onOpen)
  const onErrorRef = useRef(onError)

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
    if (!enabled) return undefined
    let cancelled = false
    let source = null

    createEventSource().then((es) => {
      if (cancelled || !es) return
      source = es

      Object.keys(eventsRef.current).forEach((eventName) => {
        const handler = (event) => {
          const currentHandler = eventsRef.current[eventName]
          if (currentHandler) currentHandler(event)
        }
        source.addEventListener(eventName, handler)
      })

      if (onErrorRef.current) {
        source.onerror = (err) => {
          onErrorRef.current?.(err)
        }
      }

      if (onOpenRef.current) {
        source.onopen = () => {
          onOpenRef.current?.()
        }
      }
    })

    return () => {
      cancelled = true
      if (source) {
        source.close()
      }
    }
  }, [enabled, eventNamesKey])
}
