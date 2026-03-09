import { ClockIcon, MapPinIcon, TruckIcon } from '@heroicons/react/24/outline'

export default function PublicHero({ config, backendUrl }) {
  const backgroundStyle = config?.banner_imagen
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(26, 17, 10, 0.84), rgba(45, 30, 18, 0.74)), url(${backendUrl}${config.banner_imagen})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : undefined

  return (
    <header className="public-hero" style={backgroundStyle}>
      <div className="public-hero__mesh" />
      <div className="public-hero__content">
        <div className="public-hero__eyebrow">Menu del restaurante</div>
        <div className="public-hero__main">
          <img src="/comanda-logo.png" alt="Comanda" className="public-hero__badge" />
          <div>
            <h1 className="public-hero__title">
              {config?.nombre_negocio || 'Menu del local'}
            </h1>
            <p className="public-hero__subtitle">
              {config?.tagline_negocio || 'Pedilo rapido, claro y sin pasos innecesarios.'}
            </p>
          </div>
        </div>

        <div className="public-hero__meta">
          <div className="public-hero__meta-card">
            <ClockIcon className="w-4 h-4" />
            <span>
              {config?.tienda_abierta ? 'Abierto ahora' : 'Fuera de horario'}
            </span>
          </div>
          {config?.delivery_habilitado && (
            <div className="public-hero__meta-card">
              <TruckIcon className="w-4 h-4" />
              <span>Delivery ${Number(config.costo_delivery || 0).toLocaleString('es-AR')}</span>
            </div>
          )}
          {config?.direccion_retiro && (
            <div className="public-hero__meta-card">
              <MapPinIcon className="w-4 h-4" />
              <span>Retiro en local</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
