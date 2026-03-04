import { CreditCardIcon } from '@heroicons/react/24/outline'

export default function PaymentPending({
  pedidoPendienteMP,
  verificandoPago,
  tiempoEspera,
  setPedidoPendienteMP
}) {
  // Desktop: waiting for MP payment in another tab
  if (pedidoPendienteMP) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-8">
        <div className="bg-surface rounded-2xl shadow-card p-8 max-w-md w-full text-center">
          <div className="relative mb-6">
            <div className="spinner spinner-lg mx-auto"></div>
            <CreditCardIcon className="w-6 h-6 text-info-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Esperando confirmacion de pago</h1>
          <p className="text-text-secondary mb-6">
            Completa el pago en MercadoPago.
            Esta pagina se actualizara automaticamente.
          </p>
          <div className="bg-surface-hover rounded-xl p-4 mb-6">
            <p className="text-sm text-text-tertiary">Pedido #{pedidoPendienteMP.id}</p>
            <p className="text-2xl font-bold text-primary-600">
              ${parseFloat(pedidoPendienteMP.total).toLocaleString('es-AR')}
            </p>
          </div>
          <p className="text-xs text-text-tertiary mb-4">
            Verificando cada 3 segundos...
          </p>
          <button
            onClick={() => {
              setPedidoPendienteMP(null)
              localStorage.removeItem('mp_pedido_pendiente')
            }}
            className="text-text-tertiary text-sm hover:underline"
          >
            Cancelar y volver al menu
          </button>
        </div>
      </div>
    )
  }

  // Redirect return: verifying MP payment
  if (verificandoPago) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-center p-8">
        <div className="bg-surface rounded-2xl shadow-card p-8 max-w-md w-full">
          <div className="relative mb-6">
            <div className="spinner spinner-lg mx-auto"></div>
            <CreditCardIcon className="w-8 h-8 text-primary-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Verificando tu pago...
          </h1>
          <p className="text-text-secondary mb-4">
            Estamos confirmando tu pago con MercadoPago. Por favor espera un momento.
          </p>
          <div className="bg-surface-hover rounded-xl p-3">
            <p className="text-sm text-text-tertiary">
              Tiempo de espera: {tiempoEspera} segundos
            </p>
            <div className="w-full bg-border-default rounded-full h-2 mt-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((tiempoEspera / 60) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <p className="text-xs text-text-tertiary mt-4">
            No cierres esta ventana
          </p>
        </div>
      </div>
    )
  }

  return null
}
