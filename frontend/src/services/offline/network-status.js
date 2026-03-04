const HEARTBEAT_INTERVAL = 15000
const HEARTBEAT_URL = '/api/health'
const HEARTBEAT_TIMEOUT = 5000

class NetworkStatus {
  constructor() {
    this.online = navigator.onLine
    this.listeners = new Set()
    this.heartbeatTimer = null
  }

  start() {
    window.addEventListener('online', this._handleOnline)
    window.addEventListener('offline', this._handleOffline)
    this._startHeartbeat()
    return this
  }

  stop() {
    window.removeEventListener('online', this._handleOnline)
    window.removeEventListener('offline', this._handleOffline)
    this._stopHeartbeat()
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _handleOnline = () => {
    this._setOnline(true)
  }

  _handleOffline = () => {
    this._setOnline(false)
  }

  _setOnline(value) {
    if (this.online !== value) {
      this.online = value
      this.listeners.forEach(fn => fn(value))
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat()
    this.heartbeatTimer = setInterval(() => this._heartbeat(), HEARTBEAT_INTERVAL)
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  async _heartbeat() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT)
      await fetch(HEARTBEAT_URL, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeout)
      this._setOnline(true)
    } catch {
      this._setOnline(false)
    }
  }
}

export const networkStatus = new NetworkStatus()
export default networkStatus
