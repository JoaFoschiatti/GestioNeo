import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import useAsync from '../hooks/useAsync'
import {
  BuildingStorefrontIcon,
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'

export default function Registro() {
  const [step, setStep] = useState(1)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState({
    nombreRestaurante: '',
    slug: '',
    nombre: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const registerRequest = useCallback(async (_ctx, payload) => {
    const response = await api.post('/registro', payload, { skipToast: true })
    return response.data
  }, [])

  const handleRegisterError = useCallback((error) => {
    const apiError = error.response?.data?.error
    const fallback = 'Error al registrar. Intenta nuevamente.'
    setError(apiError?.details?.[0]?.message || apiError?.message || error.message || fallback)
  }, [])

  const { loading, execute: registerAsync } = useAsync(
    registerRequest,
    { immediate: false, onError: handleRegisterError }
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Auto-generate slug from restaurant name
    if (name === 'nombreRestaurante') {
      const slug = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        .substring(0, 50)
        .replace(/-+$/, '')
      setFormData(prev => ({ ...prev, slug }))
    }

    setError(null)
  }

  const validateStep1 = () => {
    if (!formData.nombreRestaurante.trim()) {
      setError('Ingresa el nombre de tu restaurante')
      return false
    }
    if (!formData.slug.trim()) {
      setError('El slug es requerido')
      return false
    }
    if (formData.slug.length < 3) {
      setError('El slug debe tener al menos 3 caracteres')
      return false
    }
    if (formData.slug.length > 50) {
      setError('El slug no puede tener mas de 50 caracteres')
      return false
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(formData.slug)) {
      setError('El slug solo puede contener letras minusculas, numeros y guiones (no al inicio ni al final)')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!formData.nombre.trim()) {
      setError('Ingresa tu nombre')
      return false
    }
    if (!formData.email.trim()) {
      setError('Ingresa tu email')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email invalido')
      return false
    }
    if (!formData.password) {
      setError('Ingresa una contraseña')
      return false
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return false
    }
    return true
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return

    setError(null)

    const result = await registerAsync({
      nombreRestaurante: formData.nombreRestaurante,
      slug: formData.slug,
      nombre: formData.nombre,
      email: formData.email,
      password: formData.password
    })

    if (result) {
      setSuccess(true)
    }
  }

  // Pantalla de éxito con glassmorphism
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center overflow-hidden relative px-4"
        style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 30%, #059669 60%, #10b981 100%)',
          backgroundSize: '400% 400%',
          animation: 'gradient-shift 15s ease infinite'
        }}
      >
        {/* Blobs decorativos */}
        <div className="blob blob-1" style={{ background: 'rgba(255, 255, 255, 0.3)' }} />
        <div className="blob blob-2" style={{ background: 'rgba(134, 239, 172, 0.4)' }} />

        <div className="glass-card w-full max-w-md p-8 relative z-10 animate-fade-in-up text-center">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 border border-white/30">
            <CheckCircleIcon className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Registro Exitoso
          </h1>
          <p className="text-white/80 mb-6">
            Te enviamos un email de verificacion a <strong className="text-white">{formData.email}</strong>.
            Por favor revisa tu bandeja de entrada y confirma tu cuenta.
          </p>
          <div className="glass-info-box text-sm text-white/80 mb-6">
            <p>El link de verificacion expira en 24 horas.</p>
            <p className="mt-1">Revisa tambien tu carpeta de spam.</p>
          </div>
          <Link
            to="/login"
            className="btn-glass-primary inline-block"
          >
            Ir al Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center login-gradient-bg overflow-hidden relative px-4 py-8">
      {/* Blobs decorativos */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Card principal */}
      <div className="glass-card w-full max-w-md p-8 relative z-10 animate-fade-in-up">
        {/* Logo + título */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto mb-4 flex items-center justify-center border border-white/20">
            <span className="text-3xl">🍔</span>
          </div>
          <h1 className="text-3xl font-bold text-white">GestioNeo</h1>
          <p className="text-white/70 mt-2">Registra tu restaurante</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-medium transition-all ${
            step >= 1
              ? 'bg-white/30 text-white border border-white/40'
              : 'bg-white/10 text-white/50 border border-white/20'
          }`}>
            1
          </div>
          <div className={`w-16 h-1 rounded transition-all ${
            step >= 2 ? 'bg-white/40' : 'bg-white/20'
          }`} />
          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-medium transition-all ${
            step >= 2
              ? 'bg-white/30 text-white border border-white/40'
              : 'bg-white/10 text-white/50 border border-white/20'
          }`}>
            2
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 bg-red-500/20 backdrop-blur-sm text-white p-3 rounded-xl flex items-center gap-2 border border-red-400/30">
            <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <>
              {/* Nombre del Restaurante */}
              <div>
                <label className="glass-label">Nombre del Restaurante</label>
                <div className="relative">
                  <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type="text"
                    name="nombreRestaurante"
                    className="glass-input"
                    value={formData.nombreRestaurante}
                    onChange={handleChange}
                    placeholder="Mi Restaurante"
                    autoFocus
                  />
                </div>
              </div>

              {/* URL / Slug */}
              <div>
                <label className="glass-label">URL de tu menu</label>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-sm whitespace-nowrap">gestioneo.com/</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      name="slug"
                      className="glass-input pl-4"
                      value={formData.slug}
                      onChange={(e) => {
                        const slug = e.target.value.toLowerCase()
                          .replace(/[^a-z0-9-]/g, '')
                          .replace(/^-+/, '')
                        setFormData(prev => ({ ...prev, slug }))
                      }}
                      placeholder="mi-restaurante"
                    />
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-1.5">
                  Esta sera la URL donde tus clientes veran el menu
                </p>
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="btn-glass-primary mt-2"
              >
                Continuar
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Tu Nombre */}
              <div>
                <label className="glass-label">Tu Nombre</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type="text"
                    name="nombre"
                    className="glass-input"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Juan Perez"
                    autoFocus
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="glass-label">Email</label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type="email"
                    name="email"
                    className="glass-input"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="glass-label">Contraseña</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    className="glass-input pr-12"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
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

              {/* Confirmar Contraseña */}
              <div>
                <label className="glass-label">Confirmar Contraseña</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    className="glass-input pr-12"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                    aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-xl font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
                >
                  Atras
                </button>
                <button
                  type="submit"
                  className="btn-glass-primary flex-1 flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
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
                      Registrando...
                    </>
                  ) : (
                    'Registrarme'
                  )}
                </button>
              </div>
            </>
          )}
        </form>

        {/* Link login */}
        <div className="mt-6 text-center text-sm">
          <p className="text-white/70">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="glass-link font-medium">
              Inicia sesion
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-white/50 text-sm">
        <p>Al registrarte aceptas nuestros terminos y condiciones</p>
      </div>
    </div>
  )
}
