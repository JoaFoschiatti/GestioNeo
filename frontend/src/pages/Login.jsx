import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import useAsync from '../hooks/useAsync'
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  const loginRequest = useCallback(async (_ctx, credentials) => {
    const { email, password } = credentials
    await login(email, password, { skipToast: true })
    return true
  }, [login])

  const handleLoginError = useCallback((requestError) => {
    const message = requestError.response?.data?.error?.message || 'Error al iniciar sesion'
    setError(message)
  }, [])

  const { loading, execute: loginAsync } = useAsync(
    loginRequest,
    { immediate: false, onError: handleLoginError }
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const result = await loginAsync({ email, password })
    if (result) {
      toast.success('Bienvenido!')
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center login-gradient-bg overflow-hidden relative px-4">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="glass-card w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <img src="/comanda-logo.png" alt="Comanda" className="w-14 h-14 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
          <h1 className="text-heading-1">Comanda</h1>
          <p className="text-text-secondary mt-2">Accede a tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="alert alert-error" role="alert">
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="input-group">
            <label className="label">Email</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="email"
                className="glass-input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="usuario@ejemplo.com"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="label">Contrasena</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="glass-input pr-12"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-glass-primary mt-6"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="spinner spinner-sm border-white/30 border-t-white" />
                Ingresando...
              </span>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-white/12 pt-4 text-center text-sm text-text-secondary">
          Si no tienes acceso, solicita un usuario al administrador del local.
        </div>
      </div>
    </div>
  )
}
