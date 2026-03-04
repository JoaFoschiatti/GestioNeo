import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { getCached, setCache } from '../services/offline/cache'
import useOfflineStatus from './useOfflineStatus'

export default function useOfflineQuery(url, options = {}) {
  const { cacheKey, ttlMs = 5 * 60 * 1000, axiosOptions = {}, enabled = true } = options
  const { isOnline } = useOfflineStatus()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isStale, setIsStale] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)
  const key = cacheKey || url

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    // Try cache first
    try {
      const cached = await getCached(key)
      if (cached && mountedRef.current) {
        setData(cached)
        setIsStale(true)
        setLoading(false)
      }
    } catch {
      // IndexedDB may fail in private browsing, ignore
    }

    // If online, fetch fresh data
    if (isOnline) {
      try {
        const response = await api.get(url, { skipToast: true, ...axiosOptions })
        if (mountedRef.current) {
          setData(response.data)
          setIsStale(false)
          setError(null)
          setLoading(false)
        }
        // Update cache
        try {
          await setCache(key, response.data, ttlMs)
        } catch {
          // Cache write failure is non-critical
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err)
          // If we have cached data, keep showing it
          if (!data) {
            setLoading(false)
          }
        }
      }
    } else {
      // Offline with no cache
      if (mountedRef.current && !data) {
        setLoading(false)
      }
    }
  }, [url, key, ttlMs, isOnline, enabled])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  return { data, loading, isStale, error, refetch: fetchData }
}
