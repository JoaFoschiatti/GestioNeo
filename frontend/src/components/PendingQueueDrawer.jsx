import { useState, useEffect } from 'react'
import { XMarkIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { getAllEntries, deleteEntry } from '../services/offline/outbox'
import useOfflineStatus from '../hooks/useOfflineStatus'

export default function PendingQueueDrawer({ open, onClose }) {
  const [entries, setEntries] = useState([])
  const { triggerSync, syncStatus } = useOfflineStatus()

  useEffect(() => {
    if (open) {
      loadEntries()
    }
  }, [open])

  const loadEntries = async () => {
    try {
      const all = await getAllEntries()
      setEntries(all.filter(e => e.status !== 'synced'))
    } catch {
      setEntries([])
    }
  }

  const handleDelete = async (id) => {
    await deleteEntry(id)
    await loadEntries()
    window.dispatchEvent(new CustomEvent('offline:pending-changed', { detail: { count: entries.length - 1 } }))
  }

  const handleRetryAll = () => {
    triggerSync()
  }

  if (!open) return null

  const statusLabel = {
    pending: 'Pendiente',
    syncing: 'Sincronizando...',
    conflict: 'Conflicto',
    error: 'Error'
  }

  const statusColor = {
    pending: 'bg-amber-100 text-amber-700',
    syncing: 'bg-blue-100 text-blue-700',
    conflict: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700'
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Cola de sincronizacion</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {entries.length > 0 && (
          <div className="px-4 py-2 border-b border-border-subtle">
            <button
              onClick={handleRetryAll}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              Reintentar todo
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">
              No hay operaciones pendientes
            </p>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="rounded-lg border border-border-subtle p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {entry.description}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                      {entry.retries > 0 && ` · ${entry.retries} reintentos`}
                    </p>
                    {entry.lastError && (
                      <p className="text-xs text-red-600 mt-1">{entry.lastError}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor[entry.status] || ''}`}>
                      {statusLabel[entry.status] || entry.status}
                    </span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 rounded hover:bg-red-50 text-text-secondary hover:text-red-600"
                      title="Descartar"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
