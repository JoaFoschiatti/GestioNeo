import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function VerificarEmail() {
  const { token } = useParams()
  const [status, setStatus] = useState('verifying') // verifying, success, error
  const [error, setError] = useState(null)

  const verificarEmail = useCallback(async () => {
    if (!token) {
      setError('Token invalido')
      setStatus('error')
      return
    }

    setStatus('verifying')
    setError(null)
    try {
      await api.post(`/registro/verificar/${token}`, null, { skipToast: true })
      setStatus('success')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al verificar el email')
      setStatus('error')
    }
  }, [token])

  useEffect(() => {
    verificarEmail()
  }, [verificarEmail])

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <ArrowPathIcon className="w-16 h-16 text-primary-500 mx-auto mb-6 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Verificando tu cuenta...
            </h1>
            <p className="text-gray-600">
              Por favor espera un momento
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ExclamationCircleIcon className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Error de verificacion
            </h1>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={verificarEmail}
                className="btn btn-primary w-full py-3"
              >
                Reintentar
              </button>
              <Link
                to="/registro"
                className="btn btn-secondary w-full py-3 block"
              >
                Registrarse nuevamente
              </Link>
              <Link
                to="/login"
                className="btn btn-secondary w-full py-3 block"
              >
                Ir al Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-green-700 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Cuenta Verificada
          </h1>
          <p className="text-gray-600 mb-6">
            Tu cuenta ha sido verificada exitosamente. Ya puedes iniciar sesion y comenzar a usar Comanda.
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="btn btn-primary w-full py-3 block"
            >
              Iniciar Sesion
            </Link>
            <Link
              to="/menu"
              className="btn btn-secondary w-full py-3 block"
            >
              Ver Menu Publico
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
