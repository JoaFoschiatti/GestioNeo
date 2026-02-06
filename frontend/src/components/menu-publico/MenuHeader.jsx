import {
  ClockIcon,
  TruckIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'

import { BACKEND_URL } from '../../config/constants'

export default function MenuHeader({ config }) {
  return (
    <header
      className="menu-hero relative"
      style={config?.banner_imagen ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${BACKEND_URL}${config.banner_imagen})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : undefined}
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-3xl md:text-4xl shadow-lg">
            🍽️
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold">
              {config?.nombre_negocio || 'Nuestro Menu'}
            </h1>
            <p className="text-white/80 text-sm md:text-base mt-1">
              {config?.tagline_negocio || 'Selecciona tus productos favoritos'}
            </p>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-3 mt-6">
          <span className="inline-flex items-center gap-2 bg-green-500/80 backdrop-blur px-4 py-2 rounded-full text-sm font-medium">
            <ClockIcon className="w-4 h-4" />
            Abierto ahora
          </span>
          {config?.delivery_habilitado && (
            <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full text-sm">
              <TruckIcon className="w-4 h-4" />
              Delivery ${config.costo_delivery?.toLocaleString('es-AR')}
            </span>
          )}
          {config?.direccion_retiro && (
            <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full text-sm">
              <MapPinIcon className="w-4 h-4" />
              Retiro disponible
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
