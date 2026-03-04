import useOfflineStatus from '../hooks/useOfflineStatus'
import { SignalSlashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncStatus } = useOfflineStatus()

  if (isOnline && pendingCount === 0 && syncStatus === 'idle') {
    return null
  }

  const isSyncing = syncStatus === 'syncing'

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
        !isOnline
          ? 'bg-amber-500 text-white'
          : isSyncing
            ? 'bg-blue-500 text-white'
            : syncStatus === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-green-500 text-white'
      }`}
    >
      {!isOnline ? (
        <>
          <SignalSlashIcon className="w-4 h-4" />
          <span>Sin conexion</span>
          {pendingCount > 0 && (
            <span className="ml-1">
              &middot; {pendingCount} {pendingCount === 1 ? 'operacion pendiente' : 'operaciones pendientes'}
            </span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <ArrowPathIcon className="w-4 h-4 animate-spin" />
          <span>Sincronizando {pendingCount} {pendingCount === 1 ? 'operacion' : 'operaciones'}...</span>
        </>
      ) : syncStatus === 'error' ? (
        <>
          <span>Error de sincronizacion &middot; {pendingCount} pendientes</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <ArrowPathIcon className="w-4 h-4 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : null}
    </div>
  )
}
