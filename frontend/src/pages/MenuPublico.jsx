// ============================================================
// MENU PUBLICO - Pagina del menu QR para clientes
// ============================================================
//
// Esta pagina se accede desde: /menu
// NO requiere autenticacion - es publica para los clientes.
//
// FLUJO PRINCIPAL:
// 1. Cliente escanea codigo QR -> Abre esta pagina
// 2. Se carga la configuracion del restaurante y el menu
// 3. Cliente navega por categorias y agrega productos al carrito
// 4. Cliente puede seleccionar modificadores (extras/exclusiones)
// 5. Cliente completa datos personales y elige tipo de entrega
// 6. Cliente elige metodo de pago:
//    - EFECTIVO: Se crea el pedido directamente
//    - MERCADOPAGO: Se crea preferencia y redirige a MP
// 7. Despues del pago, se muestra confirmacion
//
// COMPONENTES EXTRAIDOS:
// - MenuHeader: Header/banner del restaurante
// - CategoryNav: Navegacion horizontal de categorias
// - ProductGrid: Grid de productos con variantes
// - CartDrawer: Sidebar desktop + modal mobile del carrito
// - CheckoutModal: Modal de checkout con formulario
// - PaymentPending: Pantallas de espera de pago MP
// - OrderConfirmation: Pantalla de pedido exitoso
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import {
  ExclamationCircleIcon,
  XMarkIcon,
  ClockIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'

import { API_URL } from '../config/constants'

// Extracted components
import MenuHeader from '../components/menu-publico/MenuHeader'
import CategoryNav from '../components/menu-publico/CategoryNav'
import ProductGrid from '../components/menu-publico/ProductGrid'
import CartDrawer from '../components/menu-publico/CartDrawer'
import CheckoutModal from '../components/menu-publico/CheckoutModal'
import PaymentPending from '../components/menu-publico/PaymentPending'
import OrderConfirmation from '../components/menu-publico/OrderConfirmation'

// ----------------------------------------------------------
// CONFIGURACION Y UTILIDADES
// ----------------------------------------------------------

/**
 * Wrapper de fetch que maneja JSON y errores de forma consistente.
 * No usa axios porque este modulo es publico y no necesita JWT.
 */
const fetchJson = async (url, options = {}, fallbackMessage = 'Error inesperado') => {
  const res = await fetch(url, options)
  let data = null
  try {
    data = await res.json()
  } catch (err) {
    data = null
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.message || fallbackMessage
    throw new Error(message)
  }

  return data
}

export default function MenuPublico() {
  // ----------------------------------------------------------
  // ROUTING Y NAVEGACION
  // ----------------------------------------------------------
  const navigate = useNavigate()
  const [searchParams] = useSearchParams() // Para leer ?pago=exito despues de MP

  // ----------------------------------------------------------
  // ESTADO: Configuracion y datos del menu
  // ----------------------------------------------------------
  const [config, setConfig] = useState(null) // Configuracion del restaurante
  const [categorias, setCategorias] = useState([]) // Categorias con productos
  const [loadError, setLoadError] = useState(null) // Error al cargar datos iniciales

  // ----------------------------------------------------------
  // ESTADO: Navegacion y UI del menu
  // ----------------------------------------------------------
  const [categoriaActiva, setCategoriaActiva] = useState('all') // Filtro de categoria
  const [variantesSeleccionadas, setVariantesSeleccionadas] = useState({}) // Variante elegida por producto base

  // ----------------------------------------------------------
  // ESTADO: Carrito de compras
  // Cada item tiene: { productoId, nombre, precio, cantidad, observaciones }
  // ----------------------------------------------------------
  const [carrito, setCarrito] = useState([])
  const [showCarrito, setShowCarrito] = useState(false) // Drawer del carrito abierto

  // ----------------------------------------------------------
  // ESTADO: Checkout (formulario de pedido)
  // ----------------------------------------------------------
  const [showCheckout, setShowCheckout] = useState(false) // Modal de checkout abierto
  const [enviandoPedido, setEnviandoPedido] = useState(false) // Procesando envio
  const [pedidoExitoso, setPedidoExitoso] = useState(null) // Pedido creado exitosamente
  const [pageError, setPageError] = useState(null) // Error general de pagina
  const [checkoutError, setCheckoutError] = useState(null) // Error en el checkout

  // ----------------------------------------------------------
  // ESTADO: MercadoPago
  // Cuando el cliente paga con MP en desktop, el pedido queda "pendiente"
  // hasta que MP confirme el pago. Mostramos una pantalla de espera
  // que hace polling al backend para verificar el estado.
  // ----------------------------------------------------------
  const [pedidoPendienteMP, setPedidoPendienteMP] = useState(null) // Pedido esperando pago MP
  const [verificandoPago, setVerificandoPago] = useState(false) // Polling activo
  const [tiempoEspera, setTiempoEspera] = useState(0) // Contador de tiempo esperando

  // ----------------------------------------------------------
  // ESTADO: Tipo de entrega (DELIVERY o RETIRO)
  // ----------------------------------------------------------
  const [tipoEntrega, setTipoEntrega] = useState('DELIVERY')

  // ----------------------------------------------------------
  // ESTADO: Datos del cliente
  // ----------------------------------------------------------
  const [clienteData, setClienteData] = useState({
    nombre: '',
    telefono: '',
    direccion: '', // Requerido solo si tipoEntrega = 'DELIVERY'
    email: '', // Opcional, para recibir confirmacion
    observaciones: '' // Notas para el pedido
  })

  // ----------------------------------------------------------
  // ESTADO: Metodo de pago
  // ----------------------------------------------------------
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [montoAbonado, setMontoAbonado] = useState('') // Para calcular vuelto

  const cargarConfigYMenu = useCallback(async () => {
    setLoadError(null)
    const [configData, menuData] = await Promise.all([
      fetchJson(
        `${API_URL}/publico/config`,
        {},
        'Error al cargar la configuracion'
      ),
      fetchJson(
        `${API_URL}/publico/menu`,
        {},
        'Error al cargar el menu'
      )
    ])
    // Flatten negocio and config into a single object for easier access
    const flatConfig = { ...configData.negocio, ...configData.config }
    setConfig(flatConfig)
    setCategorias(menuData)

    // Set default tipo entrega based on config
    if (!flatConfig.delivery_habilitado) {
      setTipoEntrega('RETIRO')
    }
    // Set default metodo pago based on config
    if (flatConfig.mercadopago_enabled && !flatConfig.efectivo_enabled) {
      setMetodoPago('MERCADOPAGO')
    } else if (!flatConfig.mercadopago_enabled && flatConfig.efectivo_enabled) {
      setMetodoPago('EFECTIVO')
    }
    return { config: flatConfig, categorias: menuData }
  }, [])

  const handleLoadError = useCallback((err) => {
    console.error('Error cargando datos:', err)
    setLoadError(err.message || 'Error al cargar el menu')
  }, [])

  const cargarConfigYMenuRequest = useCallback(async (_ctx) => (
    cargarConfigYMenu()
  ), [cargarConfigYMenu])

  const { loading, execute: cargarConfigYMenuAsync } = useAsync(
    cargarConfigYMenuRequest,
    { onError: handleLoadError }
  )

  useEffect(() => {
    if (showCheckout) {
      setCheckoutError(null)
    }
  }, [showCheckout])

  // Recuperar estado de pedido pendiente de MP al cargar
  useEffect(() => {
    const pedidoGuardado = localStorage.getItem('mp_pedido_pendiente')
    if (pedidoGuardado) {
      try {
        const data = JSON.parse(pedidoGuardado)
        // Si tiene menos de 30 minutos, mostrar opcion de verificar
        if (
          Date.now() - data.timestamp < 30 * 60 * 1000 &&
          data.pedido?.id &&
          data.accessToken
        ) {
          setPedidoPendienteMP({ ...data.pedido, accessToken: data.accessToken })
        } else {
          localStorage.removeItem('mp_pedido_pendiente')
        }
      } catch (e) {
        localStorage.removeItem('mp_pedido_pendiente')
      }
    }
  }, [])

  // Efecto para manejar el retorno de MercadoPago con polling
  useEffect(() => {
    const pagoResult = searchParams.get('pago')
    const pedidoId = searchParams.get('pedido')
    const tokenFromUrl = searchParams.get('token')

    if (!pagoResult || !pedidoId) return
    let cancelled = false
    let intervalId = null

    if (pagoResult === 'error') {
      setPageError('El pago no pudo ser procesado. Intenta nuevamente.')
      return
    }

    if (pagoResult === 'exito' || pagoResult === 'pendiente') {
      setVerificandoPago(true)
      setTiempoEspera(0)

      let accessToken = tokenFromUrl
      if (!accessToken) {
        const pendienteGuardado = localStorage.getItem('mp_pedido_pendiente')
        if (pendienteGuardado) {
          try {
            const data = JSON.parse(pendienteGuardado)
            if (String(data?.pedido?.id) === String(pedidoId) && data?.accessToken) {
              accessToken = data.accessToken
            }
          } catch (_error) {
            // Ignorar parse errors
          }
        }
      }

      if (!accessToken) {
        setVerificandoPago(false)
        setPageError('No pudimos validar el acceso al pedido. Solicita un nuevo pedido desde el menú.')
        navigate('/menu', { replace: true })
        return
      }

      let intentos = 0
      const maxIntentos = 20 // 60 segundos (20 intentos * 3 segundos)

      const verificarPago = async () => {
        try {
          const pedido = await fetchJson(
            `${API_URL}/publico/pedido/${pedidoId}?token=${encodeURIComponent(accessToken)}`,
            {},
            'Error al verificar el pago'
          )

          if (cancelled) return false
          if (pedido.estadoPago === 'APROBADO') {
            setVerificandoPago(false)
            setPedidoExitoso({ ...pedido, pagoAprobado: true })
            localStorage.removeItem('mp_pedido_pendiente')
            // Limpiar URL params
            navigate('/menu', { replace: true })
            return true
          }

          return false
        } catch (err) {
          console.error('Error verificando pago:', err)
          return false
        }
      }

      // Primera verificacion inmediata
      const iniciarPolling = async () => {
        const aprobado = await verificarPago()
        if (aprobado || cancelled) return

        // Si no esta aprobado, iniciar polling
        intervalId = setInterval(async () => {
          intentos++
          if (cancelled) return
          setTiempoEspera(intentos * 3)

          const aprobado = await verificarPago()
          if (aprobado || intentos >= maxIntentos) {
            clearInterval(intervalId)
            intervalId = null
            if (!aprobado && intentos >= maxIntentos) {
              setVerificandoPago(false)
              localStorage.removeItem('mp_pedido_pendiente')
              setPageError(
                'No pudimos confirmar tu pago. Si ya pagaste, por favor contacta al local. Tu numero de pedido es: #' +
                  pedidoId
              )
              navigate('/menu', { replace: true })
            }
          }
        }, 3000)
      }

      iniciarPolling()
    }

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [searchParams, navigate])

  // Polling automatico cuando hay pedido pendiente de MP (desktop - nueva pestana)
  useEffect(() => {
    if (!pedidoPendienteMP) return

    let intentos = 0
    const maxIntentos = 60 // 3 minutos (60 * 3 segundos)
    let cancelled = false

    const verificarPago = async () => {
      try {
        const pedido = await fetchJson(
          `${API_URL}/publico/pedido/${pedidoPendienteMP.id}?token=${encodeURIComponent(pedidoPendienteMP.accessToken)}`,
          {},
          'Error al verificar el pago'
        )

        if (cancelled) return false
        if (pedido.estadoPago === 'APROBADO') {
          setPedidoPendienteMP(null)
          setPedidoExitoso({ ...pedido, pagoAprobado: true })
          localStorage.removeItem('mp_pedido_pendiente')
          setCarrito([])
          return true
        }
        return false
      } catch (err) {
        console.error('Error verificando pago:', err)
        return false
      }
    }

    // Primera verificacion inmediata
    verificarPago()

    const interval = setInterval(async () => {
      intentos++
      if (cancelled) return
      const aprobado = await verificarPago()

      if (aprobado || intentos >= maxIntentos) {
        clearInterval(interval)
        if (!aprobado && intentos >= maxIntentos) {
          setPageError('No pudimos confirmar el pago. Si ya pagaste, el pedido se actualizara pronto.')
          setPedidoPendienteMP(null)
          localStorage.removeItem('mp_pedido_pendiente')
        }
      }
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [pedidoPendienteMP])

  const agregarAlCarrito = (producto) => {
    // Si el producto tiene variantes, usar la variante seleccionada o la predeterminada
    let productoAAgregar = producto
    if (producto.variantes && producto.variantes.length > 0) {
      const varianteSeleccionada = variantesSeleccionadas[producto.id]
      if (varianteSeleccionada) {
        productoAAgregar = varianteSeleccionada
      } else {
        // Buscar variante predeterminada o usar la primera
        const predeterminada = producto.variantes.find(v => v.esVariantePredeterminada)
        productoAAgregar = predeterminada || producto.variantes[0]
      }
    }

    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === productoAAgregar.id)
      if (existe) {
        return prev.map((item) =>
          item.id === productoAAgregar.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      }
      return [...prev, { ...productoAAgregar, cantidad: 1 }]
    })
  }

  // Seleccionar variante para un producto
  const seleccionarVariante = (productoId, variante) => {
    setVariantesSeleccionadas(prev => ({
      ...prev,
      [productoId]: variante
    }))
  }

  // Obtener precio a mostrar (variante seleccionada o precio base)
  const getPrecioMostrar = (producto) => {
    if (producto.variantes && producto.variantes.length > 0) {
      const varianteSeleccionada = variantesSeleccionadas[producto.id]
      if (varianteSeleccionada) {
        return parseFloat(varianteSeleccionada.precio)
      }
      const predeterminada = producto.variantes.find(v => v.esVariantePredeterminada)
      if (predeterminada) return parseFloat(predeterminada.precio)
      return parseFloat(producto.variantes[0].precio)
    }
    return parseFloat(producto.precio)
  }

  const actualizarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
          : item
      ).filter((item) => item.cantidad > 0)
    )
  }

  const calcularSubtotal = () => {
    return carrito.reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0)
  }

  const costoEnvio = tipoEntrega === 'DELIVERY' ? (config?.costo_delivery || 0) : 0
  const subtotal = calcularSubtotal()
  const total = subtotal + costoEnvio
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  const vuelto = metodoPago === 'EFECTIVO' && montoAbonado
    ? Math.max(0, parseFloat(montoAbonado) - total)
    : 0

  // Filtrar productos
  const productosFiltrados = categoriaActiva === 'all'
    ? categorias.flatMap(c => c.productos || [])
    : categorias.find(c => c.id === categoriaActiva)?.productos || []

  const validarFormulario = () => {
    if (!clienteData.nombre.trim()) return 'Ingresa tu nombre'
    if (!clienteData.telefono.trim()) return 'Ingresa tu telefono'
    if (!clienteData.email.trim()) return 'Ingresa tu email'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteData.email)) return 'Email invalido'
    if (tipoEntrega === 'DELIVERY' && !clienteData.direccion.trim()) return 'Ingresa tu direccion'
    if (metodoPago === 'EFECTIVO' && !montoAbonado) return 'Indica con cuanto abonas'
    if (metodoPago === 'EFECTIVO' && parseFloat(montoAbonado) < total) return 'El monto debe ser mayor o igual al total'
    return null
  }

  const enviarPedido = async () => {
    const errorValidacion = validarFormulario()
    if (errorValidacion) {
      setCheckoutError(errorValidacion)
      return
    }

    setEnviandoPedido(true)
    setCheckoutError(null)

    try {
      const pedidoData = {
        items: carrito.map(item => ({
          productoId: item.id,
          cantidad: item.cantidad
        })),
        clienteNombre: clienteData.nombre,
        clienteTelefono: clienteData.telefono,
        clienteDireccion: clienteData.direccion,
        clienteEmail: clienteData.email,
        tipoEntrega,
        metodoPago,
        montoAbonado: metodoPago === 'EFECTIVO' ? parseFloat(montoAbonado) : null,
        observaciones: clienteData.observaciones
      }

      const data = await fetchJson(
        `${API_URL}/publico/pedido`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pedidoData)
        },
        'Error al crear pedido'
      )

      // Si es MercadoPago, redirigir segun dispositivo
      if (metodoPago === 'MERCADOPAGO' && data.initPoint) {
        if (!data.publicAccessToken) {
          throw new Error('No se pudo crear el token de acceso del pedido')
        }

        // Guardar estado del pedido para recuperarlo al volver
        const estadoPedido = {
          pedido: data.pedido,
          accessToken: data.publicAccessToken,
          timestamp: Date.now()
        }
        localStorage.setItem('mp_pedido_pendiente', JSON.stringify(estadoPedido))

        // Detectar si es movil
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

        if (isMobile) {
          // En movil: redireccion normal (mejor integracion con app MP)
          window.location.href = data.initPoint
        } else {
          // En desktop: abrir nueva pestana
          const mpWindow = window.open(data.initPoint, '_blank')

          // Si el popup fue bloqueado, hacer fallback a redirect normal
          if (!mpWindow || mpWindow.closed) {
            window.location.href = data.initPoint
          } else {
            // Mostrar pantalla de "Pago en proceso"
            setPedidoPendienteMP({ ...data.pedido, accessToken: data.publicAccessToken })
            setShowCheckout(false)
          }
        }
        return
      }

      // Efectivo - mostrar confirmacion
      setPedidoExitoso(data.pedido)
      setCarrito([])
      setShowCheckout(false)
    } catch (err) {
      console.error('Error:', err)
      setCheckoutError(err.message || 'Error al procesar el pedido')
    } finally {
      setEnviandoPedido(false)
    }
  }

  const enviarPedidoWhatsApp = () => {
    const whatsapp = config?.whatsapp_numero
    if (!whatsapp) return

    const mensaje = `Hola! Quiero hacer un pedido:\n\n${carrito.map(i => `${i.cantidad}x ${i.nombre}`).join('\n')}\n\nSubtotal: $${subtotal.toLocaleString('es-AR')}${costoEnvio > 0 ? `\nEnvio: $${costoEnvio.toLocaleString('es-AR')}` : ''}\nTotal: $${total.toLocaleString('es-AR')}\n\nNombre: ${clienteData.nombre}\nTelefono: ${clienteData.telefono}\nEmail: ${clienteData.email}${tipoEntrega === 'DELIVERY' ? `\nDireccion: ${clienteData.direccion}` : '\nRetiro en local'}`
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  // ----------------------------------------------------------
  // FULL-SCREEN STATES (loading, payment pending, closed, etc.)
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center items-center">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  // Pantalla mientras el usuario paga en otra pestana (desktop) o verificando pago de MP
  if (pedidoPendienteMP || verificandoPago) {
    return (
      <PaymentPending
        pedidoPendienteMP={pedidoPendienteMP}
        verificandoPago={verificandoPago}
        tiempoEspera={tiempoEspera}
        setPedidoPendienteMP={setPedidoPendienteMP}
      />
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="bg-surface rounded-2xl shadow-card p-6 max-w-md w-full text-center">
          <ExclamationCircleIcon className="w-12 h-12 text-error-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">No pudimos cargar el menu</h1>
          <p className="text-text-secondary mb-6">{loadError}</p>
          <button
            type="button"
            onClick={cargarConfigYMenuAsync}
            className="btn btn-primary w-full py-3"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Tienda cerrada overlay
  if (config && !config.tienda_abierta) {
    return (
      <div className="min-h-screen bg-text-primary flex flex-col items-center justify-center text-center p-8">
        <LockClosedIcon className="w-24 h-24 text-text-tertiary mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Estamos Cerrados
        </h1>
        <p className="text-text-tertiary text-lg mb-6">
          {config.nombre_negocio || 'El local'} no esta recibiendo pedidos en este momento
        </p>
        <div className="bg-surface/10 rounded-xl p-6 max-w-sm w-full">
          <div className="flex items-center justify-center gap-3 text-text-tertiary">
            <ClockIcon className="w-6 h-6" />
            <span>Horario: {config.horario_apertura} - {config.horario_cierre}</span>
          </div>
        </div>
        <p className="text-text-tertiary mt-8">Volvemos pronto!</p>
      </div>
    )
  }

  // Pedido exitoso
  if (pedidoExitoso) {
    return (
      <OrderConfirmation
        pedidoExitoso={pedidoExitoso}
        setPedidoExitoso={setPedidoExitoso}
        navigate={navigate}
      />
    )
  }

  // ----------------------------------------------------------
  // MAIN MENU RENDER
  // ----------------------------------------------------------
  return (
    <div className="min-h-screen bg-canvas">
      {/* Hero Header */}
      <MenuHeader config={config} />

      {pageError && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-error-50 text-error-700 p-4 rounded-xl flex items-start gap-3">
            <ExclamationCircleIcon className="w-6 h-6 flex-shrink-0" />
            <span className="flex-1">{pageError}</span>
            <button
              type="button"
              className="text-error-500 hover:text-error-600"
              onClick={() => setPageError(null)}
              aria-label="Cerrar alerta"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Sticky Category Navigation */}
      <CategoryNav
        categorias={categorias}
        categoriaActiva={categoriaActiva}
        setCategoriaActiva={setCategoriaActiva}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-8">
          {/* Product Grid */}
          <main className="flex-1">
            <ProductGrid
              productosFiltrados={productosFiltrados}
              variantesSeleccionadas={variantesSeleccionadas}
              agregarAlCarrito={agregarAlCarrito}
              seleccionarVariante={seleccionarVariante}
              getPrecioMostrar={getPrecioMostrar}
            />
          </main>

          {/* Desktop Cart Sidebar + Mobile Floating Button + Mobile Cart Modal */}
          <CartDrawer
            carrito={carrito}
            totalItems={totalItems}
            subtotal={subtotal}
            costoEnvio={costoEnvio}
            total={total}
            tipoEntrega={tipoEntrega}
            setTipoEntrega={setTipoEntrega}
            config={config}
            showCarrito={showCarrito}
            setShowCarrito={setShowCarrito}
            setShowCheckout={setShowCheckout}
            actualizarCantidad={actualizarCantidad}
          />
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          config={config}
          carrito={carrito}
          costoEnvio={costoEnvio}
          total={total}
          tipoEntrega={tipoEntrega}
          setTipoEntrega={setTipoEntrega}
          clienteData={clienteData}
          setClienteData={setClienteData}
          metodoPago={metodoPago}
          setMetodoPago={setMetodoPago}
          montoAbonado={montoAbonado}
          setMontoAbonado={setMontoAbonado}
          vuelto={vuelto}
          enviandoPedido={enviandoPedido}
          checkoutError={checkoutError}
          setShowCheckout={setShowCheckout}
          enviarPedido={enviarPedido}
          enviarPedidoWhatsApp={enviarPedidoWhatsApp}
        />
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
