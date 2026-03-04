import { openDB } from 'idb'

const DB_NAME = 'comanda-offline'
const DB_VERSION = 1

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'id' })
          outbox.createIndex('by-status', 'status')
          outbox.createIndex('by-createdAt', 'createdAt')
        }

        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }

        if (!db.objectStoreNames.contains('id-map')) {
          db.createObjectStore('id-map', { keyPath: 'tempId' })
        }
      }
    })
  }
  return dbPromise
}

export default getDB
