import { getDB } from './db'

export async function enqueue(config) {
  const db = await getDB()
  const entry = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    method: (config.method || 'POST').toUpperCase(),
    url: config.url,
    data: config.data || null,
    tempId: config._tempId || null,
    optimisticResponse: config._optimisticResponse || null,
    status: 'pending',
    retries: 0,
    lastError: null,
    syncedAt: null,
    serverResponse: null,
    description: config._offlineDescription || 'Operacion pendiente'
  }
  await db.put('outbox', entry)
  return entry
}

export async function getAllPending() {
  const db = await getDB()
  const all = await db.getAllFromIndex('outbox', 'by-status', 'pending')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function updateEntry(entry) {
  const db = await getDB()
  await db.put('outbox', entry)
}

export async function getEntry(id) {
  const db = await getDB()
  return db.get('outbox', id)
}

export async function deleteEntry(id) {
  const db = await getDB()
  await db.delete('outbox', id)
}

export async function countPending() {
  const db = await getDB()
  const all = await db.getAllFromIndex('outbox', 'by-status', 'pending')
  return all.length
}

export async function getAllEntries() {
  const db = await getDB()
  const all = await db.getAll('outbox')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function pruneSynced(maxAgeMs = 60 * 60 * 1000) {
  const db = await getDB()
  const all = await db.getAll('outbox')
  const cutoff = Date.now() - maxAgeMs
  for (const entry of all) {
    if (entry.status === 'synced' && entry.syncedAt && entry.syncedAt < cutoff) {
      await db.delete('outbox', entry.id)
    }
  }
}
