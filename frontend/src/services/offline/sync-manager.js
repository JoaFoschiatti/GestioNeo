import axios from 'axios'
import { getAllPending, updateEntry, pruneSynced } from './outbox'
import { getDB } from './db'

// Raw axios instance that bypasses the offline interceptor
const rawApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
})

class SyncManager {
  constructor() {
    this.syncing = false
    this.listeners = new Set()
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _notify(event, data) {
    this.listeners.forEach(fn => fn(event, data))
  }

  async getIdMapping(tempId) {
    const db = await getDB()
    const mapping = await db.get('id-map', tempId)
    return mapping?.serverId || null
  }

  async setIdMapping(tempId, serverId, type = 'pedido') {
    const db = await getDB()
    await db.put('id-map', { tempId, serverId, type, createdAt: Date.now() })
  }

  rewriteTempIds(value, idMap) {
    if (!value || !idMap.size) return value
    if (typeof value === 'string') {
      for (const [tempId, serverId] of idMap) {
        value = value.replace(tempId, String(serverId))
      }
      return value
    }
    if (typeof value === 'object') {
      const result = Array.isArray(value) ? [...value] : { ...value }
      for (const key of Object.keys(result)) {
        if (typeof result[key] === 'string') {
          for (const [tempId, serverId] of idMap) {
            result[key] = result[key].replace(tempId, String(serverId))
          }
        } else if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = this.rewriteTempIds(result[key], idMap)
        }
      }
      return result
    }
    return value
  }

  async drain() {
    if (this.syncing) return
    this.syncing = true
    this._notify('syncing')

    // Collect ID mappings from IndexedDB
    const db = await getDB()
    const allMappings = await db.getAll('id-map')
    const idMap = new Map(allMappings.map(m => [m.tempId, m.serverId]))

    try {
      const entries = await getAllPending()

      for (const entry of entries) {
        entry.status = 'syncing'
        await updateEntry(entry)
        this._notify('progress', { id: entry.id, status: 'syncing' })

        // Rewrite temp IDs
        const url = this.rewriteTempIds(entry.url, idMap)
        const data = entry.data ? this.rewriteTempIds(entry.data, idMap) : null

        try {
          const response = await rawApi({
            method: entry.method,
            url,
            data
          })

          entry.status = 'synced'
          entry.serverResponse = response.data
          entry.syncedAt = Date.now()
          await updateEntry(entry)

          // Store ID mapping if this created an entity
          if (entry.tempId && response.data?.id) {
            await this.setIdMapping(entry.tempId, response.data.id)
            idMap.set(entry.tempId, response.data.id)
          }

          this._notify('synced', { id: entry.id, entry })
        } catch (error) {
          if (error.response) {
            // Server responded - client error or conflict
            const status = error.response.status
            if (status === 409) {
              entry.status = 'conflict'
              entry.lastError = error.response.data?.error?.message || 'Conflicto'
            } else if (status >= 400 && status < 500) {
              entry.status = 'error'
              entry.lastError = error.response.data?.error?.message || `Error ${status}`
            } else {
              // 5xx - retry later
              entry.status = 'pending'
              entry.retries += 1
            }
            await updateEntry(entry)
            this._notify('error', { id: entry.id, entry })
            // Continue to next entry for 4xx, stop for 5xx
            if (status >= 500) break
          } else {
            // Network error - stop draining
            entry.status = 'pending'
            entry.retries += 1
            await updateEntry(entry)
            this._notify('offline')
            break
          }
        }
      }

      // Prune old synced entries
      await pruneSynced()
    } finally {
      this.syncing = false
      this._notify('idle')
    }
  }
}

export const syncManager = new SyncManager()
export default syncManager
