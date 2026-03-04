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
      setError('Ingresa una contrasena')
      return false
    }
    if (formData.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden')
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

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center overflow-hidden relative px-4 bg-canvas">
        <div className="card card-lg w-full max-w-md relative z-10 animate-fade-in-up text-center">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-10 h-10 text-success-600" />
          </div>
          <h1 className="text-heading-2 mb-2">
            Registro Exitoso
          </h1>
          <p className="text-text-secondary mb-6">
            Te enviamos un email de verificacion a <strong className="text-text-primary">{formData.email}</strong>.
            Por favor revisa tu bandeja de entrada y confirma tu cuenta.
          </p>
          <div className="glass-info-box mb-6">
            <p>El link de verificacion expira en 24 horas.</p>
            <p className="mt-1">Revisa tambien tu carpeta de spam.</p>
          </div>
          <Link
            to="/login"
            className="btn btn-primary w-full"
          >
            Ir al Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center login-gradient-bg overflow-hidden relative px-4 py-8">
      {/* Decorative blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Main card */}
      <div className="glass-card w-full max-w-md relative z-10 animate-fade-in-up">
        {/* Logo + title */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
            <span className="text-2xl text-white font-bold">C</span>
          </div>
          <h1 className="text-heading-1">Comanda</h1>
          <p className="text-text-secondary mt-2">Registra tu restaurante</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-medium transition-all ${
            step >= 1
              ? 'bg-primary-500 text-white'
              : 'bg-surface-hover text-text-tertiary'
          }`}>
            1
          </div>
          <div className={`w-16 h-1 rounded transition-all ${
            step >= 2 ? 'bg-primary-500' : 'bg-border-default'
          }`} />
          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-medium transition-all ${
            step >= 2
              ? 'bg-primary-500 text-white'
              : 'bg-surface-hover text-text-tertiary'
          }`}>
            2
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error mb-5">
            <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <>
              {/* Restaurant name */}
              <div className="input-group">
                <label className="label">Nombre del Restaurante</label>
                <div className="relative">
                  <BuildingStorefrontIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
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
              <div className="input-group">
                <label className="label">URL de tu menu</label>
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary text-sm whitespace-nowrap">comanda.app/</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      name="slug"
                      className="input"
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
                <p className="input-hint">
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
              {/* Name */}
              <div className="input-group">
                <label className="label">Tu Nombre</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
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
              <div className="input-group">
                <label className="label">Email</label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
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

              {/* Password */}
              <div className="input-group">
                <label className="label">Contrasena</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    className="glass-input pr-12"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="********"
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

              {/* Confirm password */}
              <div className="input-group">
                <label className="label">Confirmar Contrasena</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    className="glass-input pr-12"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                    aria-label={showConfirmPassword ? 'Ocultar confirmacion' : 'Mostrar confirmacion'}
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

              {/* Buttons */}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary flex-1"
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
                      <div className="spinner spinner-sm border-white/30 border-t-white" />
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

        {/* Login link */}
        <div className="mt-6 text-center text-sm">
          <p className="text-text-secondary">
            Ya tienes cuenta?{' '}
            <Link to="/login" className="glass-link font-medium">
              Inicia sesion
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-text-tertiary text-sm">
        <p>Al registrarte aceptas nuestros terminos y condiciones</p>
      </div>
    </div>
  )
}
