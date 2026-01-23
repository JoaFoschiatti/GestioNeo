import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import useAsync from '../hooks/useAsync'
import {
  BuildingStorefrontIcon,
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'

export default function Login() {
  const { slug: urlSlug } = useParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [slug, setSlug] = useState(urlSlug || '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (urlSlug) {
      setSlug(urlSlug)
    }
  }, [urlSlug])

  const loginRequest = useCallback(async (_ctx, credentials) => {
    const { email, password, slug } = credentials
    await login(email, password, slug, { skipToast: true })
    return true
  }, [login])

  const handleLoginError = useCallback((error) => {
    const message = error.response?.data?.error?.message || 'Error al iniciar sesion'
    setError(message)
  }, [])

  const { loading, execute: loginAsync } = useAsync(
    loginRequest,
    { immediate: false, onError: handleLoginError }
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const result = await loginAsync({ email, password, slug: slug || undefined })
    if (result) {
      toast.success('Bienvenido!')
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center login-gradient-bg overflow-hidden relative px-4">
      {/* Blobs decorativos */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Card principal */}
      <div className="glass-card w-full max-w-md p-8 relative z-10 animate-fade-in-up">
        {/* Logo + título */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto mb-4 flex items-center justify-center border border-white/20">
            <span className="text-3xl">🍔</span>
          </div>
          <h1 className="text-3xl font-bold text-white">GestioNeo</h1>
          <p className="text-white/70 mt-2">Accede a tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              className="bg-red-500/20 backdrop-blur-sm text-white p-3 rounded-xl flex items-center gap-2 border border-red-400/30"
              role="alert"
            >
              <span className="text-sm">{error}</span>
            </div>
          )}
          {/* Input Restaurante */}
          {!urlSlug && (
            <div>
              <label className="glass-label">Restaurante</label>
              <div className="relative">
                <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="text"
                  className="glass-input"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setError(null)
                  }}
                  placeholder="mi-restaurante"
                />
              </div>
              <p className="text-xs text-white/50 mt-1.5">
                Deja vacío para login general
              </p>
            </div>
          )}

          {/* Input Email */}
          <div>
            <label className="glass-label">Email</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
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

          {/* Input Contraseña */}
          <div>
            <label className="glass-label">Contraseña</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="glass-input pr-12"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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

          {/* Botón Submit */}
          <button
            type="submit"
            className="btn-glass-primary mt-6"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Ingresando...
              </span>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        {/* Link registro */}
        <div className="mt-6 text-center text-sm">
          <p className="text-white/70">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="glass-link font-medium">
              Registra tu restaurante
            </Link>
          </p>
        </div>

        {/* Info de prueba */}
        <div className="mt-6 glass-info-box text-sm text-white/60">
          <p className="font-medium text-white/80 mb-2">Usuarios de prueba:</p>
          <p>Admin: admin@gestioneo.com / admin123</p>
          <p>Mozo: mozo@gestioneo.com / mozo123</p>
        </div>
      </div>
    </div>
  )
}
