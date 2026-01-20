import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import {
  BuildingStorefrontIcon,
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function Registro() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    nombreRestaurante: '',
    slug: '',
    nombre: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

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
        .substring(0, 50)
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
    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      setError('El slug solo puede contener letras minusculas, numeros y guiones')
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

    setLoading(true)
    setError(null)

    try {
      await api.post('/registro', {
        nombreRestaurante: formData.nombreRestaurante,
        slug: formData.slug,
        nombre: formData.nombre,
        email: formData.email,
        password: formData.password
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al registrar. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-green-700 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircleIcon className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Registro Exitoso
            </h1>
            <p className="text-gray-600 mb-6">
              Te enviamos un email de verificacion a <strong>{formData.email}</strong>.
              Por favor revisa tu bandeja de entrada y confirma tu cuenta.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 mb-6">
              <p>El link de verificacion expira en 24 horas.</p>
              <p className="mt-1">Revisa tambien tu carpeta de spam.</p>
            </div>
            <Link
              to="/login"
              className="btn btn-primary w-full py-3"
            >
              Ir al Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">GestioNeo</h1>
            <p className="text-gray-500 mt-2">Registra tu restaurante</p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 1 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 2 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <>
                <div>
                  <label className="label flex items-center gap-2">
                    <BuildingStorefrontIcon className="w-4 h-4" />
                    Nombre del Restaurante
                  </label>
                  <input
                    type="text"
                    name="nombreRestaurante"
                    className="input"
                    value={formData.nombreRestaurante}
                    onChange={handleChange}
                    placeholder="Mi Restaurante"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">URL de tu menu</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm whitespace-nowrap">gestioneo.com/menu/</span>
                    <input
                      type="text"
                      name="slug"
                      className="input flex-1"
                      value={formData.slug}
                      onChange={(e) => {
                        const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                        setFormData(prev => ({ ...prev, slug }))
                      }}
                      placeholder="mi-restaurante"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Esta sera la URL donde tus clientes veran el menu
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="btn btn-primary w-full py-3"
                >
                  Continuar
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="label flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Tu Nombre
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    className="input"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Juan Perez"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <EnvelopeIcon className="w-4 h-4" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="input"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-2">
                    <LockClosedIcon className="w-4 h-4" />
                    Contraseña
                  </label>
                  <input
                    type="password"
                    name="password"
                    className="input"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="label">Confirmar Contraseña</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="input"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn btn-secondary flex-1 py-3"
                  >
                    Atras
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
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

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Inicia sesion
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6 text-white/80 text-sm">
          <p>Al registrarte aceptas nuestros terminos y condiciones</p>
        </div>
      </div>
    </div>
  )
}
