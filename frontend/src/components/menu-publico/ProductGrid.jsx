import {
  PlusIcon,
  CubeIcon
} from '@heroicons/react/24/outline'

import { BACKEND_URL } from '../../config/constants'

export default function ProductGrid({
  productosFiltrados,
  variantesSeleccionadas,
  agregarAlCarrito,
  seleccionarVariante,
  getPrecioMostrar
}) {
  if (productosFiltrados.length === 0) {
    return (
      <div className="empty-state">
        <CubeIcon className="empty-state-icon" />
        <h3 className="text-text-secondary font-medium">No hay productos en esta categoria</h3>
        <p className="text-text-tertiary text-sm mt-1">Selecciona otra categoria para ver productos</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-24 lg:mb-6">
      {productosFiltrados.map((producto) => {
        const tieneVariantes = producto.variantes && producto.variantes.length > 0
        const varianteActual = variantesSeleccionadas[producto.id]
        const precioMostrar = getPrecioMostrar(producto)

        return (
          <div key={producto.id} className="product-card group">
            <div className="relative h-48 overflow-hidden bg-surface-hover">
              {producto.imagen ? (
                <img
                  src={producto.imagen.startsWith('http') ? producto.imagen : `${BACKEND_URL}${producto.imagen}`}
                  alt={producto.nombre}
                  className="product-card-image"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-hover to-border-default">
                  <CubeIcon className="w-16 h-16 text-text-tertiary" />
                </div>
              )}
              <button
                onClick={() => agregarAlCarrito(producto)}
                className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-primary-500 text-white p-3 rounded-full shadow-lg hover:bg-primary-600 hidden lg:block"
                title="Agregar al carrito"
                aria-label="Agregar al carrito"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <h3 className="font-bold text-text-primary text-lg mb-1">{producto.nombre}</h3>
              <p className="text-text-tertiary text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
                {producto.descripcion || 'Delicioso producto'}
              </p>

              {/* Selector de Variantes */}
              {tieneVariantes && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {producto.variantes.map((variante) => {
                    const isSelected = varianteActual?.id === variante.id ||
                      (!varianteActual && variante.esVariantePredeterminada) ||
                      (!varianteActual && !producto.variantes.some(v => v.esVariantePredeterminada) && variante === producto.variantes[0])

                    return (
                      <button
                        key={variante.id}
                        onClick={() => seleccionarVariante(producto.id, variante)}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
                          isSelected
                            ? 'bg-primary-500 text-white'
                            : 'bg-surface-hover text-text-secondary hover:bg-border-default'
                        }`}
                      >
                        {variante.nombreVariante}
                        <span className="ml-1 opacity-75">
                          ${parseFloat(variante.precio).toLocaleString('es-AR')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-primary-600">
                  ${precioMostrar.toLocaleString('es-AR')}
                </span>
                <button
                  onClick={() => agregarAlCarrito(producto)}
                  className="btn btn-primary text-sm py-2 px-4 lg:hidden flex items-center gap-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
