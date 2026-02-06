import { CheckCircleIcon } from '@heroicons/react/24/outline'

export default function OrderConfirmation({ pedidoExitoso, setPedidoExitoso, navigate }) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-center p-8">
      <div className="bg-surface rounded-2xl shadow-card p-8 max-w-md w-full">
        <CheckCircleIcon className="w-20 h-20 text-success-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Pedido Confirmado!
        </h1>
        <p className="text-text-secondary mb-4">
          Tu pedido #{pedidoExitoso.id} ha sido recibido correctamente
        </p>
        {pedidoExitoso.pagoAprobado && (
          <div className="bg-success-50 text-success-700 p-3 rounded-xl mb-4">
            <CheckCircleIcon className="w-5 h-5 inline mr-2" />
            Pago aprobado
          </div>
        )}

        <p className="text-sm text-text-tertiary mb-6">
          Enviamos un comprobante a tu email. Te contactaremos para coordinar la entrega.
        </p>

        <button
          onClick={() => { setPedidoExitoso(null); navigate('/menu') }}
          className="btn btn-primary w-full py-3"
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )
}
