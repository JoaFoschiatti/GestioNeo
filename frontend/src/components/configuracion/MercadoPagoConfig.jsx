import { useState, useEffect, useCallback } from 'react'
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

  const checkStatus = useCallback(async () => {
    const response = await api.get('/mercadopago/status', { skipToast: true })
    const data = response.data
    setConfigInfo(data.config)
    setStatus(data.connected ? 'connected' : 'disconnected')

    if (onStatusChange) {
      onStatusChange(data.connected)
    }
    return data
  }, [onStatusChange])

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
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3">
          <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
          <span className="text-gray-500">Cargando estado de MercadoPago...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
        <div className="flex items-center gap-3">
          <CreditCardIcon className="w-8 h-8" />
          <div>
            <h3 className="font-bold text-lg">MercadoPago</h3>
            <p className="text-blue-100 text-sm">Recibe pagos online de tus clientes</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
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
            <div className="flex items-center gap-3 bg-green-50 p-4 rounded-lg">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-semibold text-green-800">Cuenta conectada</p>
                {configInfo?.email && (
                  <p className="text-sm text-green-600">{configInfo.email}</p>
                )}
                <p className="text-xs text-green-500 mt-1">
                  {configInfo?.isOAuth ? 'Conectado via OAuth' : 'Configuracion manual'}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Los pagos de tus clientes llegaran directamente a tu cuenta de MercadoPago.
            </p>

            <button
              onClick={handleDisconnect}
              type="button"
              disabled={disconnecting}
              className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
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
            <div className="flex items-center gap-3 bg-yellow-50 p-4 rounded-lg">
              <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="font-semibold text-yellow-800">No hay cuenta conectada</p>
                <p className="text-sm text-yellow-600">
                  Conecta tu cuenta para recibir pagos online
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Al conectar tu cuenta de MercadoPago, los clientes podran pagar sus pedidos
              con tarjeta de credito, debito o dinero en cuenta directamente desde el menu.
            </p>

            {/* OAuth Button */}
            <button
              onClick={handleConnectOAuth}
              type="button"
              disabled={connecting || statusLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
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
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mx-auto"
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
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <p className="text-sm text-gray-600">
                  Si prefieres, puedes ingresar tu Access Token de MercadoPago manualmente.
                  Puedes obtenerlo desde el{' '}
                  <a
                    href="https://www.mercadopago.com.ar/developers/panel/app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Panel de Desarrolladores
                  </a>.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="mp-access-token">
                    Access Token
                  </label>
                  <input
                    id="mp-access-token"
                    type="password"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="APP_USR-xxxx..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={handleSaveManual}
                  type="button"
                  disabled={savingManual || !manualToken.trim()}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-2" />
            <p className="text-red-600">Error al cargar estado</p>
            <button
              onClick={checkStatusAsync}
              type="button"
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
