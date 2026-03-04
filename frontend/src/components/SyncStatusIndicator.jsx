import useOfflineStatus from '../hooks/useOfflineStatus'
import { ArrowPathIcon, CloudIcon } from '@heroicons/react/24/outline'

export default function SyncStatusIndicator() {
  const { pendingCount, syncStatus, isOnline } = useOfflineStatus()

  if (pendingCount === 0 && syncStatus === 'idle') return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
      {syncStatus === 'syncing' ? (
        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-blue-500" />
      ) : !isOnline ? (
        <CloudIcon className="w-3.5 h-3.5 text-amber-500" />
      ) : null}
      {pendingCount > 0 && (
        <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
          {pendingCount}
        </span>
      )}
    </div>
  )
}
