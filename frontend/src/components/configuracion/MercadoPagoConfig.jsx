import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import useAsync from '../../hooks/useAsync'
import {
  CreditCardIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LinkIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'

export default function MercadoPagoConfig({ onStatusChange }) {
  const [status, setStatus] = useState(null) // null, 'loading', 'connected', 'disconnected', 'error'
  const [configInfo, setConfigInfo] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [error, setError] = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Use ref to avoid infinite loop from callback dependency
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const checkStatus = useCallback(async () => {
    const response = await api.get('/mercadopago/status', { skipToast: true })
    const data = response.data
    setConfigInfo(data.config)
    setStatus(data.connected ? 'connected' : 'disconnected')

    if (onStatusChangeRef.current) {
      onStatusChangeRef.current(data.connected)
    }
    return data
  }, [])

  const handleLoadError = useCallback((err) => {
    console.error('Error checking MP status:', err)
    setStatus('error')
  }, [])

  const checkStatusRequest = useCallback(async (_ctx) => (
    checkStatus()
  ), [checkStatus])

  const { loading: statusLoading, execute: checkStatusAsync } = useAsync(
    checkStatusRequest,
    { onError: handleLoadError }
  )

  useEffect(() => {
    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search)
    const mpResult = params.get('mp')
    if (mpResult === 'connected') {
      setStatus('connected')
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (mpResult === 'error') {
      setError('Error al conectar con MercadoPago. Intenta nuevamente.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnectOAuth = async () => {
    try {
      setConnecting(true)
      const response = await api.get('/mercadopago/oauth/authorize', { skipToast: true })
      const data = response.data
      // Redirect to MercadoPago OAuth
      window.location.href = data.authUrl
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
      setConnecting(false)
    }
  }

  const handleSaveManual = async () => {
    if (!manualToken.trim()) {
      setError('Ingresa el Access Token')
      return
    }

    try {
      setSavingManual(true)
      setError(null)

      const response = await api.post(
        '/mercadopago/config/manual',
        { accessToken: manualToken },
        { skipToast: true }
      )

      const data = response.data

      setStatus('connected')
      setConfigInfo({ email: data.email, isOAuth: false, isActive: true })
      setManualToken('')
      setShowManual(false)

      if (onStatusChange) {
        onStatusChange(true)
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setSavingManual(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Deseas desconectar tu cuenta de MercadoPago? Los clientes no podran pagar con MercadoPago hasta que vuelvas a conectar.')) {
      return
    }

    try {
      setDisconnecting(true)
      await api.delete('/mercadopago/oauth/disconnect', { skipToast: true })

      setStatus('disconnected')
      setConfigInfo(null)

      if (onStatusChange) {
        onStatusChange(false)
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (statusLoading && !status) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <ArrowPathIcon className="w-6 h-6 animate-spin text-text-tertiary" />
          <span className="text-text-secondary">Cargando estado de MercadoPago...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border-subtle">
        <div className="p-2 bg-info-100 rounded-xl">
          <CreditCardIcon className="w-6 h-6 text-info-600" />
        </div>
        <div>
          <h3 className="font-bold text-text-primary">MercadoPago</h3>
          <p className="text-text-secondary text-sm">Recibe pagos online de tus clientes</p>
        </div>
      </div>

      {/* Content */}
      <div>
        {/* Error message */}
        {error && (
          <div className="mb-4 bg-error-50 text-error-700 p-3 rounded-xl flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              type="button"
              aria-label="Cerrar mensaje de error"
              className="ml-auto"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Connected state */}
        {status === 'connected' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-success-50 p-4 rounded-xl">
              <CheckCircleIcon className="w-8 h-8 text-success-500" />
              <div>
                <p className="font-semibold text-success-800">Cuenta conectada</p>
                {configInfo?.email && (
                  <p className="text-sm text-success-600">{configInfo.email}</p>
                )}
                <p className="text-xs text-success-500 mt-1">
                  {configInfo?.isOAuth ? 'Conectado via OAuth' : 'Configuracion manual'}
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary">
              Los pagos de tus clientes llegaran directamente a tu cuenta de MercadoPago.
            </p>

            <button
              onClick={handleDisconnect}
              type="button"
              disabled={disconnecting}
              className="text-error-600 hover:text-error-700 text-sm font-medium flex items-center gap-1"
            >
              {disconnecting ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <XMarkIcon className="w-4 h-4" />
              )}
              Desconectar cuenta
            </button>
          </div>
        )}

        {/* Disconnected state */}
        {status === 'disconnected' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-warning-50 p-4 rounded-xl">
              <ExclamationTriangleIcon className="w-8 h-8 text-warning-500" />
              <div>
                <p className="font-semibold text-warning-800">No hay cuenta conectada</p>
                <p className="text-sm text-warning-600">
                  Conecta tu cuenta para recibir pagos online
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary">
              Al conectar tu cuenta de MercadoPago, los clientes podran pagar sus pedidos
              con tarjeta de credito, debito o dinero en cuenta directamente desde el menu.
            </p>

            {/* OAuth Button */}
            <button
              onClick={handleConnectOAuth}
              type="button"
              disabled={connecting || statusLoading}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {connecting ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <LinkIcon className="w-5 h-5" />
              )}
              Conectar con MercadoPago
            </button>

            {/* Manual config toggle */}
            <button
              onClick={() => setShowManual(!showManual)}
              type="button"
              className="text-sm text-text-tertiary hover:text-text-secondary flex items-center gap-1 mx-auto"
            >
              {showManual ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
              Configuracion manual (avanzado)
            </button>

            {/* Manual config form */}
            {showManual && (
              <div className="mt-4 p-4 bg-surface-hover rounded-xl space-y-3">
                <p className="text-sm text-text-secondary">
                  Si prefieres, puedes ingresar tu Access Token de MercadoPago manualmente.
                  Puedes obtenerlo desde el{' '}
                  <a
                    href="https://www.mercadopago.com.ar/developers/panel/app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Panel de Desarrolladores
                  </a>.
                </p>

                <div>
                  <label className="label" htmlFor="mp-access-token">
                    Access Token
                  </label>
                  <input
                    id="mp-access-token"
                    type="password"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="APP_USR-xxxx..."
                    className="input"
                  />
                </div>

                <button
                  onClick={handleSaveManual}
                  type="button"
                  disabled={savingManual || !manualToken.trim()}
                  className="btn btn-secondary w-full flex items-center justify-center gap-2"
                >
                  {savingManual ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="w-4 h-4" />
                  )}
                  Guardar configuracion
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="text-center py-4">
            <ExclamationTriangleIcon className="w-12 h-12 text-error-400 mx-auto mb-2" />
            <p className="text-error-600">Error al cargar estado</p>
            <button
              onClick={checkStatusAsync}
              type="button"
              className="mt-2 text-primary-600 hover:underline text-sm"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
