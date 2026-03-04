/**
 * Simple in-memory cache with TTL.
 * Used to reduce database queries for auth and subscription checks.
 */
class MemoryCache {
  constructor(ttlMs = 30000) {
    this._store = new Map();
    this._ttlMs = ttlMs;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this._store.set(key, { value, expiresAt: Date.now() + this._ttlMs });
  }

  delete(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }
}

const userCache = new MemoryCache(30000);      // 30s TTL
const subscriptionCache = new MemoryCache(60000); // 60s TTL

module.exports = { MemoryCache, userCache, subscriptionCache };
