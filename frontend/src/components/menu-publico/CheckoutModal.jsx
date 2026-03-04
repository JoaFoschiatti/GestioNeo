import {
  XMarkIcon,
  TruckIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CreditCardIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'

export default function CheckoutModal({
  config,
  carrito,
  costoEnvio,
  total,
  tipoEntrega,
  setTipoEntrega,
  clienteData,
  setClienteData,
  metodoPago,
  setMetodoPago,
  montoAbonado,
  setMontoAbonado,
  vuelto,
  enviandoPedido,
  checkoutError,
  setShowCheckout,
  enviarPedido,
  enviarPedidoWhatsApp
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0 bg-text-primary/80 backdrop-blur-sm"
        onClick={() => setShowCheckout(false)}
      />

      <div className="relative bg-surface w-full md:max-w-lg md:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-default flex justify-between items-center sticky top-0 bg-surface z-10">
          <h2 className="text-xl font-bold text-text-primary">Datos de Entrega</h2>
          <button
            onClick={() => setShowCheckout(false)}
            className="p-2 hover:bg-surface-hover rounded-full"
            aria-label="Cerrar checkout"
          >
            <XMarkIcon className="w-6 h-6 text-text-tertiary" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Error message */}
          {checkoutError && (
            <div className="bg-error-50 text-error-700 p-3 rounded-xl flex items-center gap-2">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}

          {/* Tipo de entrega */}
          <div>
            <label className="label">Tipo de Entrega</label>
            <div className="grid grid-cols-2 gap-3">
              {config?.delivery_habilitado && (
                <button
                  type="button"
                  onClick={() => setTipoEntrega('DELIVERY')}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    tipoEntrega === 'DELIVERY'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-border-default hover:border-border-subtle'
                  }`}
                >
                  <TruckIcon className="w-8 h-8 mx-auto mb-2 text-primary-500" />
                  <p className="font-semibold text-text-primary">Delivery</p>
                  <p className="text-sm text-text-tertiary">+${config.costo_delivery?.toLocaleString('es-AR')}</p>
                </button>
              )}
              <button
                type="button"
                onClick={() => setTipoEntrega('RETIRO')}
                className={`p-4 rounded-xl border text-center transition-all ${
                  tipoEntrega === 'RETIRO'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-border-default hover:border-border-subtle'
                }`}
              >
                <MapPinIcon className="w-8 h-8 mx-auto mb-2 text-primary-500" />
                <p className="font-semibold text-text-primary">Retiro</p>
                <p className="text-sm text-text-tertiary">Gratis</p>
              </button>
            </div>
            {tipoEntrega === 'RETIRO' && config?.direccion_retiro && (
              <p className="text-sm text-text-secondary mt-2 bg-surface-hover p-2 rounded-lg">
                <MapPinIcon className="w-4 h-4 inline mr-1" />
                Retirar en: {config.direccion_retiro}
              </p>
            )}
          </div>

          {/* Datos del cliente */}
          <div>
            <label className="label">Nombre *</label>
            <input
              type="text"
              className="input"
              value={clienteData.nombre}
              onChange={(e) => setClienteData({ ...clienteData, nombre: e.target.value })}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="label">Telefono *</label>
            <input
              type="tel"
              className="input"
              value={clienteData.telefono}
              onChange={(e) => setClienteData({ ...clienteData, telefono: e.target.value })}
              placeholder="11-xxxx-xxxx"
            />
          </div>
          <div>
            <label className="label">Email * (recibiras tu comprobante)</label>
            <input
              type="email"
              className="input"
              value={clienteData.email}
              onChange={(e) => setClienteData({ ...clienteData, email: e.target.value })}
              placeholder="tu@email.com"
            />
          </div>
          {tipoEntrega === 'DELIVERY' && (
            <div>
              <label className="label">Direccion de Entrega *</label>
              <input
                type="text"
                className="input"
                value={clienteData.direccion}
                onChange={(e) => setClienteData({ ...clienteData, direccion: e.target.value })}
                placeholder="Calle, numero, piso, depto"
              />
            </div>
          )}
          <div>
            <label className="label">Observaciones (opcional)</label>
            <textarea
              className="input"
              rows="2"
              value={clienteData.observaciones}
              onChange={(e) => setClienteData({ ...clienteData, observaciones: e.target.value })}
              placeholder="Sin cebolla, con extra queso, etc."
            />
          </div>

          {/* Resumen */}
          <div className="bg-surface-hover p-4 rounded-xl space-y-2">
            <h3 className="font-semibold text-text-secondary mb-3">Resumen del Pedido</h3>
            {carrito.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-text-secondary">{item.cantidad}x {item.nombre}</span>
                <span className="font-medium text-text-primary">${(parseFloat(item.precio) * item.cantidad).toLocaleString('es-AR')}</span>
              </div>
            ))}
            {costoEnvio > 0 && (
              <div className="flex justify-between text-sm text-text-secondary pt-2 border-t border-border-default">
                <span>Costo de envio</span>
                <span>${costoEnvio.toLocaleString('es-AR')}</span>
              </div>
            )}
            <div className="border-t border-border-default pt-2 mt-2 flex justify-between font-bold text-lg">
              <span className="text-text-primary">Total:</span>
              <span className="text-primary-600">${total.toLocaleString('es-AR')}</span>
            </div>
          </div>

          {/* Metodo de pago */}
          <div>
            <label className="label">Metodo de Pago</label>
            {!config?.mercadopago_enabled && !config?.efectivo_enabled ? (
              <div className="bg-warning-50 text-warning-700 p-4 rounded-xl">
                <ExclamationCircleIcon className="w-6 h-6 inline mr-2" />
                El negocio no tiene metodos de pago configurados. Contacta al local para realizar tu pedido.
              </div>
            ) : (
              <>
                <div className={`grid gap-3 ${
                  config?.mercadopago_enabled && config?.efectivo_enabled
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
                }`}>
                  {config?.mercadopago_enabled && (
                    <button
                      type="button"
                      onClick={() => setMetodoPago('MERCADOPAGO')}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        metodoPago === 'MERCADOPAGO'
                          ? 'border-info-500 bg-info-50'
                          : 'border-border-default hover:border-border-subtle'
                      }`}
                    >
                      <CreditCardIcon className="w-8 h-8 mx-auto mb-2 text-info-500" />
                      <p className="font-semibold text-sm text-text-primary">MercadoPago</p>
                      <p className="text-xs text-text-tertiary mt-1">Tarjeta o dinero en cuenta</p>
                    </button>
                  )}
                  {config?.efectivo_enabled && (
                    <button
                      type="button"
                      onClick={() => setMetodoPago('EFECTIVO')}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        metodoPago === 'EFECTIVO'
                          ? 'border-success-500 bg-success-50'
                          : 'border-border-default hover:border-border-subtle'
                      }`}
                    >
                      <BanknotesIcon className="w-8 h-8 mx-auto mb-2 text-success-500" />
                      <p className="font-semibold text-sm text-text-primary">Efectivo</p>
                      <p className="text-xs text-text-tertiary mt-1">Pagas al recibir</p>
                    </button>
                  )}
                </div>
                {!config?.mercadopago_enabled && config?.efectivo_enabled && (
                  <p className="text-sm text-text-tertiary mt-2 text-center">
                    Solo se acepta pago en efectivo al momento de la entrega
                  </p>
                )}
              </>
            )}
          </div>

          {/* Monto abonado para efectivo */}
          {metodoPago === 'EFECTIVO' && (
            <div className="bg-success-50 p-4 rounded-xl space-y-3">
              <label className="label text-success-800">Con cuanto abonas? *</label>
              <input
                type="number"
                className="input text-lg"
                value={montoAbonado}
                onChange={(e) => setMontoAbonado(e.target.value)}
                placeholder={`Minimo $${total.toLocaleString('es-AR')}`}
                min={total}
                step="100"
              />
              {vuelto > 0 && (
                <div className="flex justify-between text-success-700 font-semibold">
                  <span>Tu vuelto:</span>
                  <span>${vuelto.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>
          )}

          {/* Boton confirmar */}
          <button
            onClick={enviarPedido}
            disabled={enviandoPedido || (!config?.mercadopago_enabled && !config?.efectivo_enabled)}
            className={`btn w-full py-4 text-lg flex items-center justify-center gap-2 ${
              metodoPago === 'MERCADOPAGO'
                ? 'bg-info-500 hover:bg-info-600 text-white'
                : 'btn-primary'
            } ${(enviandoPedido || (!config?.mercadopago_enabled && !config?.efectivo_enabled)) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {enviandoPedido ? (
              <>
                <div className="spinner" />
                Procesando...
              </>
            ) : metodoPago === 'MERCADOPAGO' ? (
              <>
                <CreditCardIcon className="w-6 h-6" />
                Pagar con MercadoPago
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-6 h-6" />
                Confirmar Pedido
              </>
            )}
          </button>

          {/* WhatsApp alternative */}
          {config?.whatsapp_numero && (
            <button
              onClick={enviarPedidoWhatsApp}
              className="btn w-full py-3 bg-success-500 hover:bg-success-600 text-white flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              O consultar por WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
