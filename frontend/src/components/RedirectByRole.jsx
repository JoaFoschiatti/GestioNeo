import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

  switch (usuario.rol) {
    case 'ADMIN':
      return <Navigate to="/dashboard" replace />
    case 'MOZO':
      return <Navigate to="/mozo/mesas" replace />
    case 'COCINERO':
      return <Navigate to="/cocina" replace />
    case 'CAJERO':
      return <Navigate to="/dashboard" replace />
    case 'DELIVERY':
      return <Navigate to="/delivery/pedidos" replace />
    default:
      return <Navigate to="/login" replace />
  }
}
