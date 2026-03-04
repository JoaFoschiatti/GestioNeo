import { useOfflineContext } from '../context/OfflineContext'

export default function useOfflineStatus() {
  return useOfflineContext()
}
