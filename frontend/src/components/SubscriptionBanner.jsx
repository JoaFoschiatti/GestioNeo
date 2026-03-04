import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ExclamationTriangleIcon, CreditCardIcon } from '@heroicons/react/24/outline'

export default function SubscriptionBanner() {
  const { suscripcion, modoSoloLectura, esAdmin, esSuperAdmin } = useAuth()

  // Don't show for super admin or if subscription is active
  if (esSuperAdmin || !modoSoloLectura) {
    return null
  }

  const isPending = !suscripcion || suscripcion.estado === 'PENDIENTE' || suscripcion.estado === 'SIN_SUSCRIPCION'
  const isMorosa = suscripcion?.estado === 'MOROSA'

  const getBannerStyle = () => {
    if (isMorosa) {
      return 'bg-error-50 border-error-200 text-error-700'
    }
    return 'bg-warning-50 border-warning-200 text-warning-700'
  }

  const getMessage = () => {
    if (isMorosa) {
      return 'Tu suscripcion tiene pagos pendientes. Regulariza tu cuenta para continuar usando todas las funciones.'
    }
    if (isPending) {
      return 'Activa tu suscripcion para desbloquear todas las funciones del sistema.'
    }
    return 'Tu suscripcion ha expirado. Renueva para continuar usando el sistema.'
  }

  const Icon = isMorosa ? ExclamationTriangleIcon : CreditCardIcon

  return (
    <div className={`border-b px-4 py-3 ${getBannerStyle()}`}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {getMessage()}
            <span className="block sm:inline sm:ml-1 text-xs opacity-75">
              Estas en modo solo lectura.
            </span>
          </p>
        </div>
        {esAdmin && (
          <Link
            to="/suscripcion"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <CreditCardIcon className="w-4 h-4" />
            {isPending ? 'Activar suscripcion' : 'Renovar suscripcion'}
          </Link>
        )}
      </div>
    </div>
  )
}
