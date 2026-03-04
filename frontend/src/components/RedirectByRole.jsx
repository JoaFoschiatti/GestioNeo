import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDefaultRouteForRole } from '../config/permissions'

export default function RedirectByRole() {
  const { usuario, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getDefaultRouteForRole(usuario.rol)} replace />
}
