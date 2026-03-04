import { getDB } from './db'

export async function getCached(key) {
  const db = await getDB()
  const entry = await db.get('cache', key)
  if (!entry) return null
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    await db.delete('cache', key)
    return null
  }
  return entry.data
}

export async function setCache(key, data, ttlMs = null) {
  const db = await getDB()
  await db.put('cache', {
    key,
    data,
    updatedAt: Date.now(),
    expiresAt: ttlMs ? Date.now() + ttlMs : null
  })
}

export async function invalidateCache(key) {
  const db = await getDB()
  await db.delete('cache', key)
}

export async function clearAllCache() {
  const db = await getDB()
  await db.clear('cache')
}
