import {
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  TruckIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'

export default function CartDrawer({
  carrito,
  totalItems,
  subtotal,
  costoEnvio,
  total,
  tipoEntrega,
  setTipoEntrega,
  config,
  showCarrito,
  setShowCarrito,
  setShowCheckout,
  actualizarCantidad
}) {
  return (
    <>
      {/* Desktop Cart Sidebar */}
      <aside className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
        <div className="sticky top-24 cart-sidebar">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <ShoppingCartIcon className="w-6 h-6" />
              <h2 className="font-bold text-lg">Tu Pedido</h2>
              {totalItems > 0 && (
                <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-sm">
                  {totalItems} items
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[40vh] overflow-y-auto p-4 space-y-3 cart-scroll">
            {carrito.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCartIcon className="w-12 h-12 mx-auto text-text-tertiary mb-3" />
                <p className="text-text-secondary text-sm">Tu carrito esta vacio</p>
                <p className="text-text-tertiary text-xs mt-1">Agrega productos para comenzar</p>
              </div>
            ) : (
              carrito.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-surface-hover p-3 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.nombre}</h4>
                    <p className="text-primary-600 text-sm font-semibold">
                      ${(parseFloat(item.precio) * item.cantidad).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => actualizarCantidad(item.id, -1)}
                      className="qty-btn"
                      aria-label="Reducir cantidad"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center font-medium text-sm">{item.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(item.id, 1)}
                      className="qty-btn"
                      aria-label="Aumentar cantidad"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {carrito.length > 0 && (
            <div className="border-t border-border-default p-4 bg-surface-hover">
              {/* Tipo de entrega selector */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {config?.delivery_habilitado && (
                  <button
                    onClick={() => setTipoEntrega('DELIVERY')}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      tipoEntrega === 'DELIVERY'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-border-default hover:border-border-subtle'
                    }`}
                  >
                    <TruckIcon className="w-5 h-5 mx-auto mb-1" />
                    Delivery
                    <span className="block text-xs text-text-tertiary">+${config.costo_delivery?.toLocaleString('es-AR')}</span>
                  </button>
                )}
                <button
                  onClick={() => setTipoEntrega('RETIRO')}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    tipoEntrega === 'RETIRO'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-border-default hover:border-border-subtle'
                  }`}
                >
                  <MapPinIcon className="w-5 h-5 mx-auto mb-1" />
                  Retiro
                  <span className="block text-xs text-text-tertiary">Gratis</span>
                </button>
              </div>

              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('es-AR')}</span>
                </div>
                {costoEnvio > 0 && (
                  <div className="flex justify-between text-text-secondary">
                    <span>Envio</span>
                    <span>${costoEnvio.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t border-border-default">
                  <span className="text-text-primary">Total</span>
                  <span className="text-primary-600">${total.toLocaleString('es-AR')}</span>
                </div>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                className="btn btn-primary w-full py-3 text-lg shadow-lg"
              >
                Continuar al Pedido
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Floating Cart Button */}
      {totalItems > 0 && (
        <button
          onClick={() => setShowCarrito(true)}
          className="floating-cart-btn lg:hidden"
        >
          <ShoppingCartIcon className="w-6 h-6" />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">{totalItems} productos</span>
            <span className="text-lg font-bold">${total.toLocaleString('es-AR')}</span>
          </div>
        </button>
      )}

      {/* Mobile Cart Modal */}
      {showCarrito && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-text-primary/80 backdrop-blur-sm"
            onClick={() => setShowCarrito(false)}
          />

          <div className="absolute inset-x-0 bottom-0 bg-surface rounded-t-3xl max-h-[85vh] overflow-hidden animate-slide-up">
            <div className="sticky top-0 bg-surface p-4 border-b border-border-default flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShoppingCartIcon className="w-6 h-6 text-primary-500" />
                <h2 className="text-xl font-bold text-text-primary">Tu Pedido</h2>
              </div>
              <button
                onClick={() => setShowCarrito(false)}
                className="p-2 hover:bg-surface-hover rounded-full"
                aria-label="Cerrar carrito"
              >
                <XMarkIcon className="w-6 h-6 text-text-tertiary" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[40vh]">
              {carrito.map((item) => (
                <div key={item.id} className="flex items-center gap-4 bg-surface-hover p-3 rounded-xl">
                  <div className="flex-1">
                    <h4 className="font-medium text-text-primary">{item.nombre}</h4>
                    <p className="text-sm text-text-tertiary">
                      ${parseFloat(item.precio).toLocaleString('es-AR')} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => actualizarCantidad(item.id, -1)}
                      className="qty-btn"
                      aria-label="Reducir cantidad"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(item.id, 1)}
                      className="qty-btn"
                      aria-label="Aumentar cantidad"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tipo entrega mobile */}
            <div className="px-4 py-3 bg-surface-hover border-t border-border-default">
              <p className="text-sm font-medium text-text-secondary mb-2">Tipo de entrega</p>
              <div className="grid grid-cols-2 gap-2">
                {config?.delivery_habilitado && (
                  <button
                    onClick={() => setTipoEntrega('DELIVERY')}
                    className={`p-2 rounded-xl border text-sm font-medium ${
                      tipoEntrega === 'DELIVERY'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-border-default'
                    }`}
                  >
                    <TruckIcon className="w-4 h-4 inline mr-1" />
                    Delivery +${config.costo_delivery?.toLocaleString('es-AR')}
                  </button>
                )}
                <button
                  onClick={() => setTipoEntrega('RETIRO')}
                  className={`p-2 rounded-xl border text-sm font-medium ${
                    tipoEntrega === 'RETIRO'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-border-default'
                  }`}
                >
                  <MapPinIcon className="w-4 h-4 inline mr-1" />
                  Retiro (Gratis)
                </button>
              </div>
            </div>

            <div className="sticky bottom-0 bg-surface p-4 border-t border-border-default">
              <div className="space-y-1 text-sm mb-3">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('es-AR')}</span>
                </div>
                {costoEnvio > 0 && (
                  <div className="flex justify-between text-text-secondary">
                    <span>Envio</span>
                    <span>${costoEnvio.toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xl font-bold mb-4">
                <span className="text-text-primary">Total:</span>
                <span className="text-primary-600">${total.toLocaleString('es-AR')}</span>
              </div>
              <button
                onClick={() => { setShowCarrito(false); setShowCheckout(true) }}
                className="btn btn-primary w-full py-3 text-lg"
              >
                Continuar al Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
