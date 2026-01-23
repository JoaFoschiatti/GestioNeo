import { useEffect, useRef } from 'react'
import { createEventSource } from '../services/eventos'

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
    const source = createEventSource()
    if (!source) return undefined

    const listeners = {}
    Object.keys(eventsRef.current).forEach((eventName) => {
      const handler = (event) => {
        const currentHandler = eventsRef.current[eventName]
        if (currentHandler) currentHandler(event)
      }
      listeners[eventName] = handler
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

    return () => {
      Object.entries(listeners).forEach(([eventName, handler]) => {
        source.removeEventListener(eventName, handler)
      })
      source.close()
    }
  }, [enabled, eventNamesKey])
}
