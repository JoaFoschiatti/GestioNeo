// ============================================================
// MENÚ PÚBLICO - Página del menú QR para clientes
// ============================================================
//
// Esta página se accede desde: /menu
// NO requiere autenticación - es pública para los clientes.
//
// FLUJO PRINCIPAL:
// 1. Cliente escanea código QR → Abre esta página
// 2. Se carga la configuración del restaurante y el menú
// 3. Cliente navega por categorías y agrega productos al carrito
// 4. Cliente puede seleccionar modificadores (extras/exclusiones)
// 5. Cliente completa datos personales y elige tipo de entrega
// 6. Cliente elige método de pago:
//    - EFECTIVO: Se crea el pedido directamente
//    - MERCADOPAGO: Se crea preferencia y redirige a MP
// 7. Después del pago, se muestra confirmación
//
// ESTADOS PRINCIPALES:
// - config: Configuración del restaurante (nombre, horarios, métodos de pago)
// - categorias: Categorías con sus productos disponibles
// - carrito: Items seleccionados por el cliente
// - clienteData: Datos del cliente (nombre, teléfono, dirección)
// - tipoEntrega: 'DELIVERY' o 'RETIRO'
// - metodoPago: 'EFECTIVO' o 'MERCADOPAGO'
// - pedidoPendienteMP: Pedido esperando confirmación de MercadoPago
//
// COMPONENTES INTERNOS:
// - Navegación de categorías (tabs horizontales)
// - Grid de productos con variantes
// - Carrito lateral (drawer)
// - Modal de checkout con formulario
// - Pantalla de espera de pago MP
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import {
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  ClockIcon,
  TruckIcon,
  CubeIcon,
  MapPinIcon,
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CreditCardIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'

// ----------------------------------------------------------
// CONFIGURACIÓN Y UTILIDADES
// ----------------------------------------------------------

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const BACKEND_URL = API_URL.replace('/api', '')

// Mapeo de nombres de categoría a emojis para mejor UX visual
const categoryIcons = {
  hamburguesas: '🍔',
  pizzas: '🍕',
  bebidas: '🥤',
  postres: '🍰',
  ensaladas: '🥗',
  carnes: '🥩',
  pastas: '🍝',
  entradas: '🥟',
  sandwiches: '🥪',
  papas: '🍟',
  combos: '🍱',
  default: '🍽️'
}

const getCategoryEmoji = (nombre) => {
  const key = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [cat, emoji] of Object.entries(categoryIcons)) {
    if (key.includes(cat)) return emoji
  }
  return categoryIcons.default
}

/**
 * Wrapper de fetch que maneja JSON y errores de forma consistente.
 * No usa axios porque este módulo es público y no necesita JWT.
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
  // ROUTING Y NAVEGACIÓN
  // ----------------------------------------------------------
  const navigate = useNavigate()
  const [searchParams] = useSearchParams() // Para leer ?pago=exito después de MP

  // ----------------------------------------------------------
  // ESTADO: Configuración y datos del menú
  // ----------------------------------------------------------
  const [config, setConfig] = useState(null) // Configuración del restaurante
  const [categorias, setCategorias] = useState([]) // Categorías con productos
  const [loadError, setLoadError] = useState(null) // Error al cargar datos iniciales

  // ----------------------------------------------------------
  // ESTADO: Navegación y UI del menú
  // ----------------------------------------------------------
  const [categoriaActiva, setCategoriaActiva] = useState('all') // Filtro de categoría
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
  const [enviandoPedido, setEnviandoPedido] = useState(false) // Procesando envío
  const [pedidoExitoso, setPedidoExitoso] = useState(null) // Pedido creado exitosamente
  const [pageError, setPageError] = useState(null) // Error general de página
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
    email: '', // Opcional, para recibir confirmación
    observaciones: '' // Notas para el pedido
  })

  // ----------------------------------------------------------
  // ESTADO: Método de pago
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
        // Si tiene menos de 30 minutos, mostrar opción de verificar
        if (Date.now() - data.timestamp < 30 * 60 * 1000) {
          setPedidoPendienteMP(data.pedido)
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

      let intentos = 0
      const maxIntentos = 20 // 60 segundos (20 intentos * 3 segundos)

      const verificarPago = async () => {
        try {
          const pedido = await fetchJson(
            `${API_URL}/publico/pedido/${pedidoId}`,
            {},
            'Error al verificar el pago'
          )

          if (cancelled) return false
          if (pedido.estadoPago === 'APROBADO') {
            setVerificandoPago(false)
            setPedidoExitoso({ ...pedido, pagoAprobado: true })
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

      // Primera verificación inmediata
      const iniciarPolling = async () => {
        const aprobado = await verificarPago()
        if (aprobado || cancelled) return

        // Si no está aprobado, iniciar polling
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
              setPageError(
                'No pudimos confirmar tu pago. Si ya pagaste, por favor contacta al local. Tu número de pedido es: #' +
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

  // Polling automático cuando hay pedido pendiente de MP (desktop - nueva pestaña)
  useEffect(() => {
    if (!pedidoPendienteMP) return

    let intentos = 0
    const maxIntentos = 60 // 3 minutos (60 * 3 segundos)
    let cancelled = false

    const verificarPago = async () => {
      try {
        const pedido = await fetchJson(
          `${API_URL}/publico/pedido/${pedidoPendienteMP.id}`,
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

    // Primera verificación inmediata
    verificarPago()

    const interval = setInterval(async () => {
      intentos++
      if (cancelled) return
      const aprobado = await verificarPago()

      if (aprobado || intentos >= maxIntentos) {
        clearInterval(interval)
        if (!aprobado && intentos >= maxIntentos) {
          setPageError('No pudimos confirmar el pago. Si ya pagaste, el pedido se actualizará pronto.')
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

      // Si es MercadoPago, redirigir según dispositivo
      if (metodoPago === 'MERCADOPAGO' && data.initPoint) {
        // Guardar estado del pedido para recuperarlo al volver
        const estadoPedido = {
          pedidoId: data.pedido.id,
          pedido: data.pedido,
          total: data.pedido.total,
          timestamp: Date.now()
        }
        localStorage.setItem('mp_pedido_pendiente', JSON.stringify(estadoPedido))

        // Detectar si es móvil
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

        if (isMobile) {
          // En móvil: redirección normal (mejor integración con app MP)
          window.location.href = data.initPoint
        } else {
          // En desktop: abrir nueva pestaña
          const mpWindow = window.open(data.initPoint, '_blank')

          // Si el popup fue bloqueado, hacer fallback a redirect normal
          if (!mpWindow || mpWindow.closed) {
            window.location.href = data.initPoint
          } else {
            // Mostrar pantalla de "Pago en proceso"
            setPedidoPendienteMP(data.pedido)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center items-center">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  // Pantalla mientras el usuario paga en otra pestaña (desktop)
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

  // Verificando pago de MercadoPago
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

  return (
    <div className="min-h-screen bg-canvas">
      {/* Hero Header */}
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
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            <button
              onClick={() => setCategoriaActiva('all')}
              className={`category-pill ${categoriaActiva === 'all' ? 'category-pill-active' : 'category-pill-inactive'}`}
            >
              <span className="text-lg">🍽️</span>
              <span>Todos</span>
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaActiva(cat.id)}
                className={`category-pill ${categoriaActiva === cat.id ? 'category-pill-active' : 'category-pill-inactive'}`}
              >
                <span className="text-lg">{getCategoryEmoji(cat.nombre)}</span>
                <span>{cat.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-8">
          {/* Product Grid */}
          <main className="flex-1">
            {productosFiltrados.length === 0 ? (
              <div className="empty-state">
                <CubeIcon className="empty-state-icon" />
                <h3 className="text-text-secondary font-medium">No hay productos en esta categoria</h3>
                <p className="text-text-tertiary text-sm mt-1">Selecciona otra categoria para ver productos</p>
              </div>
            ) : (
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
            )}
          </main>

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
        </div>
      </div>

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

      {/* Checkout Modal */}
      {showCheckout && (
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
                    <div className={`grid gap-3 ${config?.mercadopago_enabled && config?.efectivo_enabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
