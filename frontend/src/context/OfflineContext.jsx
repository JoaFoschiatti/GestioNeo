import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import networkStatus from '../services/offline/network-status'
import { syncManager } from '../services/offline/sync-manager'
import { countPending } from '../services/offline/outbox'

const OfflineContext = createContext({
  isOnline: true,
  pendingCount: 0,
  syncStatus: 'idle' // 'idle' | 'syncing' | 'error'
})

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(networkStatus.online)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState('idle')
  const wasOfflineRef = useRef(!networkStatus.online)

  // Initialize pending count
  useEffect(() => {
    countPending().then(setPendingCount).catch(() => {})
  }, [])

  // Network status listener
  useEffect(() => {
    networkStatus.start()
    const unsubscribe = networkStatus.subscribe((online) => {
      setIsOnline(online)
      if (online && wasOfflineRef.current) {
        // Came back online - trigger sync
        syncManager.drain()
      }
      wasOfflineRef.current = !online
    })
    return () => {
      unsubscribe()
      networkStatus.stop()
    }
  }, [])

  // Sync manager listener
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((event) => {
      if (event === 'syncing') {
        setSyncStatus('syncing')
      } else if (event === 'idle') {
        setSyncStatus('idle')
        countPending().then(setPendingCount).catch(() => {})
      } else if (event === 'offline' || event === 'error') {
        setSyncStatus(event === 'offline' ? 'idle' : 'error')
        countPending().then(setPendingCount).catch(() => {})
      } else if (event === 'synced' || event === 'progress') {
        countPending().then(setPendingCount).catch(() => {})
      }
    })
    return unsubscribe
  }, [])

  // Listen for outbox changes from api.js interceptor
  useEffect(() => {
    const handler = (e) => {
      setPendingCount(e.detail?.count || 0)
    }
    window.addEventListener('offline:pending-changed', handler)
    return () => window.removeEventListener('offline:pending-changed', handler)
  }, [])

  const triggerSync = useCallback(() => {
    syncManager.drain()
  }, [])

  return (
    <OfflineContext.Provider value={{
      isOnline,
      pendingCount,
      syncStatus,
      triggerSync
    }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  return useContext(OfflineContext)
}

export default OfflineContext
