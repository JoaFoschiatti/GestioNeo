import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { slug: urlSlug } = useParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [slug, setSlug] = useState(urlSlug || '')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (urlSlug) {
      setSlug(urlSlug)
    }
  }, [urlSlug])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(email, password, slug || undefined)
      toast.success('Bienvenido!')
      navigate('/dashboard')
    } catch (error) {
      // El error ya se maneja en el interceptor de axios
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">GestioNeo</h1>
            <p className="text-gray-500 mt-2">Sistema de Gestión</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!urlSlug && (
              <div>
                <label className="label">Restaurante (slug)</label>
                <input
                  type="text"
                  className="input"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="mi-restaurante"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deja vacio para login general (si tu email es unico)
                </p>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                required
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-3"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link to="/registro" className="text-primary-600 hover:text-primary-700 font-medium">
                Registra tu restaurante
              </Link>
            </p>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p className="font-medium mb-2">Usuarios de prueba:</p>
            <p>Admin: admin@gestioneo.com / admin123</p>
            <p>Mozo: mozo@gestioneo.com / mozo123</p>
          </div>
        </div>
      </div>
    </div>
  )
}
