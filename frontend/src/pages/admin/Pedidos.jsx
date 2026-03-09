import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import {
  EyeIcon,
  PrinterIcon,
  CurrencyDollarIcon,
  PlusIcon,
  QrCodeIcon,
  ArrowPathIcon,
  TruckIcon
} from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Modal, PageHeader, Spinner, Table } from '../../components/ui'
import useEventSource from '../../hooks/useEventSource'
import NuevoPedidoModal from '../../components/pedidos/NuevoPedidoModal'
import useAsync from '../../hooks/useAsync'
import { parseBooleanFlag, parsePositiveIntParam } from '../../utils/query-params'

const estadoBadges = {
  PENDIENTE: 'badge-warning',
  EN_PREPARACION: 'badge-info',
  LISTO: 'badge-success',
  ENTREGADO: 'badge-info',
  COBRADO: 'badge-success',
  CERRADO: 'badge-info',
  CANCELADO: 'badge-error'
}

const sumPagosRegistrados = (pagos = []) => pagos
  .filter((pago) => !['RECHAZADO', 'CANCELADO'].includes(pago.estado))
  .reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0)

const calcularPendientePedido = (pedido) => Math.max(
  0,
  parseFloat(pedido?.total || 0) - sumPagosRegistrados(pedido?.pagos || [])
)

const buildPagoForm = (pedido, overrides = {}) => ({
  monto: calcularPendientePedido(pedido).toFixed(2),
  metodo: 'EFECTIVO',
  referencia: '',
  canalCobro: 'CAJA',
  propinaMonto: '',
  propinaMetodo: 'EFECTIVO',
  montoAbonado: '',
  ...overrides
})

const getLatestQrPresencialPago = (pedido, orderId = null) => {
  const pagos = (pedido?.pagos || [])
    .filter((pago) => pago.canalCobro === 'QR_PRESENCIAL')
    .filter((pago) => (orderId ? String(pago.referencia) === String(orderId) : true))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

  return pagos[0] || null
}

const buildQrPresencialState = (pago) => {
  if (!pago) {
    return null
  }

  const pendiente = parseFloat(pago.monto || 0)
  const propinaMonto = parseFloat(pago.propinaMonto || 0)

  return {
    orderId: pago.referencia || null,
    status: pago.estado || 'PENDIENTE',
    qrData: pago.comprobante,
    totalAmount: pendiente + propinaMonto,
    pendiente,
    propinaMonto
  }
}

const buildQrPresencialStateFromResponse = (response) => ({
  orderId: response?.orderId || null,
  status: response?.status || 'CREATED',
  qrData: response?.qrData || null,
  totalAmount: parseFloat(response?.totalAmount || 0),
  pendiente: parseFloat(response?.pendiente || 0),
  propinaMonto: parseFloat(response?.propinaMonto || 0)
})

const getQrStatusLabel = (status) => {
  const normalizedStatus = status?.toString().toUpperCase()

  switch (normalizedStatus) {
    case 'CREATED':
      return 'QR generado'
    case 'PENDING':
    case 'PENDIENTE':
      return 'Pendiente de pago'
    case 'APPROVED':
    case 'APROBADO':
      return 'Aprobado'
    case 'REJECTED':
    case 'RECHAZADO':
      return 'Rechazado'
    case 'CANCELLED':
    case 'CANCELADO':
      return 'Cancelado'
    case 'CLOSED':
    case 'PAID':
    case 'PROCESSED':
      return 'Cobro recibido'
    default:
      return status || 'Pendiente'
  }
}

export default function Pedidos() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const esSoloMozo = usuario?.rol === 'MOZO'
  const puedeCrearPedido = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
  const pedidoEnfocadoId = parsePositiveIntParam(searchParams.get('pedidoId'))
  const abrirPagoDesdeQuery = parseBooleanFlag(searchParams.get('openPago'))

  const [pedidos, setPedidos] = useState([])
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [showPagoModal, setShowPagoModal] = useState(false)
  const qrSyncInFlightRef = useRef(false)
  const deliveryModalPedidoRef = useRef(null)
  const [pagoForm, setPagoForm] = useState({
    monto: '',
    metodo: 'EFECTIVO',
    referencia: '',
    canalCobro: 'CAJA',
    propinaMonto: '',
    propinaMetodo: 'EFECTIVO',
    montoAbonado: ''
  })
  const [qrPresencial, setQrPresencial] = useState(null)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [syncingQr, setSyncingQr] = useState(false)
  const [showNuevoPedidoModal, setShowNuevoPedidoModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [showAsignarDeliveryModal, setShowAsignarDeliveryModal] = useState(false)
  const [pedidoDeliveryListoId, setPedidoDeliveryListoId] = useState(null)
  const [repartidores, setRepartidores] = useState([])
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState('')
  const [asignandoDelivery, setAsignandoDelivery] = useState(false)

  const cargarPedidos = useCallback(async () => {
    const params = new URLSearchParams()
    if (filtroEstado) params.set('estado', filtroEstado)
    if (filtroEstado === 'CERRADO' || filtroEstado === 'CANCELADO') params.set('incluirCerrados', 'true')
    const qs = params.toString()
    const response = await api.get(`/pedidos${qs ? `?${qs}` : ''}`)
    const { data, total } = response.data
    setPedidos(data)
    setTotalPedidos(total)
    return data
  }, [filtroEstado])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
  }, [])

  const cargarPedidosRequest = useCallback(async (_ctx) => (
    cargarPedidos()
  ), [cargarPedidos])

  const { loading, execute: cargarPedidosAsync } = useAsync(
    cargarPedidosRequest,
    { immediate: false, onError: handleLoadError }
  )

  const actualizarPedidoLocal = useCallback((pedidoActualizado) => {
    if (!pedidoActualizado?.id) {
      return
    }

    setPedidos((current) => {
      const exists = current.some(p => p.id === pedidoActualizado.id)
      if (exists) {
        return current.map(p => p.id === pedidoActualizado.id
          ? { ...p, ...pedidoActualizado, impresion: pedidoActualizado.impresion ?? p.impresion }
          : p
        )
      }
      return [pedidoActualizado, ...current]
    })
  }, [])

  const obtenerPedidoPorId = useCallback(async (id) => {
    const response = await api.get(`/pedidos/${id}`)
    actualizarPedidoLocal(response.data)
    return response.data
  }, [actualizarPedidoLocal])

  const clearFocusParams = useCallback(() => {
    if (!searchParams.get('pedidoId') && !searchParams.get('openPago')) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('pedidoId')
    nextParams.delete('openPago')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  // Cargar pedidos cuando cambia el filtro
  useEffect(() => {
    cargarPedidosAsync()
      .catch(() => {})
  }, [cargarPedidosAsync])

  const abrirAsignarDelivery = useCallback(async (pedidoId) => {
    if (deliveryModalPedidoRef.current === pedidoId) return
    deliveryModalPedidoRef.current = pedidoId
    setPedidoDeliveryListoId(pedidoId)
    try {
      const res = await api.get('/pedidos/delivery/repartidores')
      setRepartidores(res.data)
      setRepartidorSeleccionado(res.data.length === 1 ? String(res.data[0].id) : '')
    } catch {
      setRepartidores([])
    }
    setShowAsignarDeliveryModal(true)
  }, [])

  const handleSseUpdate = useCallback((event) => {
    let data = null
    try { data = JSON.parse(event.data) } catch {}
    const pedidoId = data?.id || data?.pedidoId
    if (!pedidoId) return

    if (data?.tipo === 'DELIVERY' && data?.estado === 'LISTO' && puedeCrearPedido) {
      toast('Pedido delivery #' + data.id + ' listo para despachar', { icon: '🚀', duration: 8000 })
      abrirAsignarDelivery(data.id)
    }

    obtenerPedidoPorId(pedidoId).catch(() => {})
  }, [obtenerPedidoPorId, puedeCrearPedido, abrirAsignarDelivery])

  const handleSseError = useCallback((err) => {
    console.error('[SSE] Error en conexión:', err)
  }, [])

  const handleSseOpen = useCallback(() => {
    console.log('[SSE] Conexión establecida')
  }, [])

  useEventSource({
    events: {
      'pedido.updated': handleSseUpdate,
      'pago.updated': handleSseUpdate,
      'impresion.updated': handleSseUpdate
    },
    onError: handleSseError,
    onOpen: handleSseOpen
  })

  const cerrarModalPago = useCallback(() => {
    qrSyncInFlightRef.current = false
    setShowPagoModal(false)
    setQrPresencial(null)
    setGeneratingQr(false)
    setSyncingQr(false)
    setPagoForm(buildPagoForm(null))
  }, [])

  const verDetalle = useCallback(async (id) => {
    try {
      const pedido = await obtenerPedidoPorId(id)
      setPedidoSeleccionado(pedido)
      setShowModal(true)
    } catch (error) {
      console.error('Error:', error)
    }
  }, [obtenerPedidoPorId])

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado: nuevoEstado })
      toast.success(`Estado cambiado a ${nuevoEstado}`)
      cargarPedidosAsync()
        .catch(() => {})
      if (pedidoSeleccionado?.id === id) {
        verDetalle(id)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const abrirPago = useCallback(async (pedido) => {
    try {
      const pedidoActualizado = await obtenerPedidoPorId(pedido.id)
      const qrPendiente = getLatestQrPresencialPago(pedidoActualizado)
      const qrPendienteActiva = qrPendiente?.estado === 'PENDIENTE'
        ? buildQrPresencialState(qrPendiente)
        : null

      setPedidoSeleccionado(pedidoActualizado)
      setQrPresencial(qrPendienteActiva)
      setPagoForm(buildPagoForm(pedidoActualizado, qrPendienteActiva
        ? {
            metodo: 'MERCADOPAGO',
            canalCobro: 'QR_PRESENCIAL',
            propinaMonto: qrPendienteActiva.propinaMonto > 0
              ? qrPendienteActiva.propinaMonto.toFixed(2)
              : '',
            propinaMetodo: 'MERCADOPAGO'
          }
        : {}
      ))
      setShowPagoModal(true)
    } catch (error) {
      console.error('Error:', error)
    }
  }, [obtenerPedidoPorId])

  useEffect(() => {
    if (!pedidoEnfocadoId) {
      return
    }

    const openFromQuery = async () => {
      try {
        if (abrirPagoDesdeQuery) {
          await abrirPago({ id: pedidoEnfocadoId })
        } else {
          await verDetalle(pedidoEnfocadoId)
        }
      } finally {
        clearFocusParams()
      }
    }

    openFromQuery().catch(() => {})
  }, [abrirPago, abrirPagoDesdeQuery, clearFocusParams, pedidoEnfocadoId])

  const handleCanalCobroChange = useCallback((canalCobro) => {
    const pendiente = calcularPendientePedido(pedidoSeleccionado)

    setQrPresencial(null)
    setPagoForm((current) => ({
      ...current,
      monto: pendiente.toFixed(2),
      canalCobro,
      metodo: canalCobro === 'QR_PRESENCIAL'
        ? 'MERCADOPAGO'
        : current.canalCobro === 'QR_PRESENCIAL'
          ? 'EFECTIVO'
          : current.metodo,
      referencia: canalCobro === 'QR_PRESENCIAL' ? '' : current.referencia,
      montoAbonado: canalCobro === 'QR_PRESENCIAL' ? '' : current.montoAbonado,
      propinaMetodo: canalCobro === 'QR_PRESENCIAL'
        ? 'MERCADOPAGO'
        : current.canalCobro === 'QR_PRESENCIAL'
          ? 'EFECTIVO'
          : current.propinaMetodo
    }))
  }, [pedidoSeleccionado])

  const syncQrStatus = useCallback(async ({ silent = false } = {}) => {
    if (!pedidoSeleccionado?.id || !qrPresencial?.orderId || qrSyncInFlightRef.current) {
      return null
    }

    qrSyncInFlightRef.current = true
    if (!silent) {
      setSyncingQr(true)
    }

    try {
      const pedidoActualizado = await obtenerPedidoPorId(pedidoSeleccionado.id)
      const qrPago = getLatestQrPresencialPago(pedidoActualizado, qrPresencial.orderId)

      setPedidoSeleccionado(pedidoActualizado)

      if (qrPago?.estado === 'APROBADO' || ['COBRADO', 'CERRADO'].includes(pedidoActualizado.estado)) {
        toast.success('Pago QR aprobado')
        cerrarModalPago()
        cargarPedidosAsync()
          .catch(() => {})
        return pedidoActualizado
      }

      if (qrPago && ['RECHAZADO', 'CANCELADO'].includes(qrPago.estado)) {
        toast.error('El cobro QR fue rechazado o cancelado')
        setQrPresencial(null)
        setPagoForm(buildPagoForm(pedidoActualizado))
        return pedidoActualizado
      }

      if (qrPago) {
        setQrPresencial(buildQrPresencialState(qrPago))
      }

      return pedidoActualizado
    } catch (error) {
      console.error('Error:', error)
      return null
    } finally {
      qrSyncInFlightRef.current = false
      if (!silent) {
        setSyncingQr(false)
      }
    }
  }, [cerrarModalPago, cargarPedidosAsync, obtenerPedidoPorId, pedidoSeleccionado, qrPresencial])

  useEffect(() => {
    if (!showPagoModal || !qrPresencial?.orderId) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      syncQrStatus({ silent: true })
        .catch(() => {})
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [showPagoModal, qrPresencial?.orderId, syncQrStatus])

  const registrarPago = async (e) => {
    e.preventDefault()
    try {
      if (pagoForm.canalCobro === 'QR_PRESENCIAL') {
        setGeneratingQr(true)

        const response = await api.post('/pagos/qr/orden', {
          pedidoId: pedidoSeleccionado.id,
          propinaMonto: pagoForm.propinaMonto ? parseFloat(pagoForm.propinaMonto) : 0,
          propinaMetodo: pagoForm.propinaMonto ? 'MERCADOPAGO' : null
        })

        setQrPresencial(buildQrPresencialStateFromResponse(response.data))

        const pedidoActualizado = await obtenerPedidoPorId(pedidoSeleccionado.id)
        setPedidoSeleccionado(pedidoActualizado)
        toast.success('QR presencial generado')
        return
      }

      const response = await api.post('/pagos', {
        pedidoId: pedidoSeleccionado.id,
        monto: parseFloat(pagoForm.monto),
        metodo: pagoForm.metodo,
        referencia: pagoForm.referencia || null,
        canalCobro: pagoForm.canalCobro,
        propinaMonto: pagoForm.propinaMonto ? parseFloat(pagoForm.propinaMonto) : 0,
        propinaMetodo: pagoForm.propinaMonto ? pagoForm.propinaMetodo : null,
        montoAbonado: pagoForm.metodo === 'EFECTIVO' && pagoForm.montoAbonado
          ? parseFloat(pagoForm.montoAbonado)
          : null
      })

      if (response.data?.pedido) {
        setPedidoSeleccionado(response.data.pedido)
        actualizarPedidoLocal(response.data.pedido)
      }

      toast.success('Pago registrado')
      cerrarModalPago()
      cargarPedidosAsync()
        .catch(() => {})
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setGeneratingQr(false)
    }
  }

  const cerrarPedido = async (pedido) => {
    try {
      await api.post(`/pedidos/${pedido.id}/cerrar`, {})
      toast.success(`Pedido #${pedido.id} cerrado`)
      cargarPedidosAsync().catch(() => {})
      if (pedidoSeleccionado?.id === pedido.id) {
        verDetalle(pedido.id)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const liberarMesa = async (mesaId) => {
    try {
      await api.post(`/mesas/${mesaId}/liberar`, {})
      toast.success('Mesa liberada')
      setShowModal(false)
      cargarPedidosAsync().catch(() => {})
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const imprimirComanda = async (id) => {
    try {
      await api.post(`/impresion/comanda/${id}/reimprimir`, {})
      toast.success('Reimpresion encolada')
      const preview = await api.get(`/impresion/comanda/${id}/preview?tipo=CAJA`)
      setPreviewContent(String(preview.data || ''))
      setShowPreviewModal(true)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const confirmarAsignarDelivery = async () => {
    if (!repartidorSeleccionado || !pedidoDeliveryListoId) return
    setAsignandoDelivery(true)
    try {
      await api.patch(`/pedidos/${pedidoDeliveryListoId}/asignar-delivery`, {
        repartidorId: Number(repartidorSeleccionado)
      })
      toast.success('Repartidor asignado')
      setShowAsignarDeliveryModal(false)
      setPedidoDeliveryListoId(null)
      deliveryModalPedidoRef.current = null
      setRepartidorSeleccionado('')
      cargarPedidosAsync().catch(() => {})
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setAsignandoDelivery(false)
    }
  }


  const renderImpresion = (impresion) => {
    if (!impresion) {
      return <span className="text-xs text-text-tertiary">-</span>
    }

    const label = impresion.status === 'OK'
      ? `OK ${impresion.ok}/${impresion.total}`
      : impresion.status === 'ERROR'
        ? `ERR ${impresion.ok}/${impresion.total}`
        : `${impresion.ok}/${impresion.total}`

    const badgeClass = impresion.status === 'OK'
      ? 'badge-success'
      : impresion.status === 'ERROR'
        ? 'badge-error'
        : 'badge-warning'

    return (
      <span title={impresion.lastError || ''} className={`badge ${badgeClass}`}>
        {label}
      </span>
    )
  }

  const getTipoBadge = (tipo) => {
    switch (tipo) {
      case 'DELIVERY': return 'badge-info'
      case 'MOSTRADOR': return 'badge-warning'
      default: return 'badge-info'
    }
  }

  const esQrPresencial = pagoForm.canalCobro === 'QR_PRESENCIAL'
  const qrStatusLabel = getQrStatusLabel(qrPresencial?.status)
  const metricas = useMemo(() => {
    const pedidosPendientes = pedidos.filter((pedido) => !['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedido.estado)).length
    const pedidosPorCerrar = pedidos.filter((pedido) => pedido.estado === 'COBRADO').length
    const pedidosConQrPendiente = pedidos.filter((pedido) => getLatestQrPresencialPago(pedido)?.estado === 'PENDIENTE').length
    return [
      {
        label: 'Pedidos activos',
        value: pedidosPendientes,
        icon: EyeIcon,
        accent: 'bg-primary-50 text-primary-700',
        hint: 'Operacion en curso'
      },
      {
        label: 'Listos para cierre',
        value: pedidosPorCerrar,
        icon: CurrencyDollarIcon,
        accent: 'bg-success-50 text-success-700',
        hint: 'Cobros ya tomados'
      },
      {
        label: 'QR pendiente',
        value: pedidosConQrPendiente,
        icon: QrCodeIcon,
        accent: 'bg-warning-50 text-warning-700',
        hint: 'Requieren seguimiento'
      }
    ]
  }, [pedidos])
  const pedidosPorCerrar = metricas[1].value

  if (loading && pedidos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="Cargando pedidos..." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Pedidos"
        eyebrow="Operacion"
        description="Gestion de estados, cobros, QR presencial e impresion de caja."
        actions={
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="pedidos-filtro-estado">Filtrar por estado</label>
            <select
              id="pedidos-filtro-estado"
              className="input w-48"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Activos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PREPARACION">En preparacion</option>
              <option value="LISTO">Listo</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="COBRADO">Cobrado</option>
              <option value="CERRADO">Cerrado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            {puedeCrearPedido && (
              <Button onClick={() => setShowNuevoPedidoModal(true)} icon={PlusIcon}>
                Nuevo Pedido
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {metricas.map((metric) => (
          <div key={metric.label} className="stat-card flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${metric.accent}`}>
              <metric.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="stat-label">{metric.label}</p>
              <p className="stat-value">{metric.value}</p>
              <p className="mt-1 text-xs text-text-tertiary">{metric.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {pedidosPorCerrar > 0 && (
        <Alert variant="warning" className="mb-6">
          Hay {pedidosPorCerrar} pedidos cobrados que todavia necesitan cierre operativo.
        </Alert>
      )}

      <div className="card overflow-hidden">
        {pedidos.length === 0 ? (
          <EmptyState
            title="No hay pedidos para mostrar"
            description="Cuando ingresen pedidos, vas a poder gestionarlos desde esta bandeja."
          />
        ) : (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Header>#</Table.Header>
                <Table.Header>Tipo</Table.Header>
                <Table.Header>Mesa/Cliente</Table.Header>
                <Table.Header>Total</Table.Header>
                <Table.Header>Estado</Table.Header>
                <Table.Header>Impresion</Table.Header>
                <Table.Header>Hora</Table.Header>
                <Table.Header className="text-right">Acciones</Table.Header>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {pedidos.map((pedido) => (
                <Table.Row key={pedido.id}>
                  <Table.Cell className="font-medium text-text-primary">#{pedido.id}</Table.Cell>
                  <Table.Cell>
                    <span className={`badge ${getTipoBadge(pedido.tipo)}`}>
                      {pedido.tipo}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-text-secondary">
                    {pedido.tipo === 'MESA'
                      ? `Mesa ${pedido.mesa?.numero}`
                      : pedido.tipo === 'MOSTRADOR'
                        ? pedido.clienteNombre || 'Mostrador'
                        : pedido.clienteNombre || 'Sin nombre'}
                    {pedido.tipo === 'DELIVERY' && pedido.repartidor && (
                      <span className="block text-xs text-primary-500">
                        Repartidor: {pedido.repartidor.nombre}
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="font-medium text-text-primary">
                    ${parseFloat(pedido.total).toLocaleString('es-AR')}
                  </Table.Cell>
                  <Table.Cell>
                    <span className={`badge ${estadoBadges[pedido.estado]}`}>
                      {pedido.estado.replace('_', ' ')}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {renderImpresion(pedido.impresion)}
                  </Table.Cell>
                  <Table.Cell className="text-text-tertiary">
                    {new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </Table.Cell>
                  <Table.Cell className="text-right space-x-2">
                    <button
                      onClick={() => verDetalle(pedido.id)}
                      type="button"
                      aria-label={`Ver detalle del pedido #${pedido.id}`}
                      className="text-primary-500 hover:text-primary-600 transition-colors"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => imprimirComanda(pedido.id)}
                      type="button"
                      aria-label={`Reimprimir comanda del pedido #${pedido.id}`}
                      className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <PrinterIcon className="w-5 h-5" />
                    </button>
                    {pedido.tipo === 'DELIVERY' && pedido.estado === 'LISTO' && !pedido.repartidorId && puedeCrearPedido && (
                      <button
                        onClick={() => abrirAsignarDelivery(pedido.id)}
                        type="button"
                        aria-label={`Asignar repartidor al pedido #${pedido.id}`}
                        className="text-primary-500 hover:text-primary-600 transition-colors"
                      >
                        <TruckIcon className="w-5 h-5" />
                      </button>
                    )}
                    {!['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedido.estado) && !esSoloMozo && (
                      <button
                        onClick={() => abrirPago(pedido)}
                        type="button"
                        aria-label={`Registrar pago del pedido #${pedido.id}`}
                        className="text-success-500 hover:text-success-600 transition-colors"
                      >
                        <CurrencyDollarIcon className="w-5 h-5" />
                      </button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {pedidos.length > 0 && pedidos.length < totalPedidos && (
        <div className="mt-4 text-center">
          <Button
            variant="secondary"
            onClick={async () => {
              const params = new URLSearchParams()
              if (filtroEstado) params.set('estado', filtroEstado)
              if (filtroEstado === 'CERRADO' || filtroEstado === 'CANCELADO') params.set('incluirCerrados', 'true')
              params.set('offset', String(pedidos.length))
              const res = await api.get(`/pedidos?${params.toString()}`)
              const { data } = res.data
              setPedidos(prev => [...prev, ...data])
            }}
          >
            Cargar mas ({pedidos.length} de {totalPedidos})
          </Button>
        </div>
      )}

      {/* Modal Detalle */}
      {showModal && pedidoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-heading-3">Pedido #{pedidoSeleccionado.id}</h2>
              <span className={`badge ${estadoBadges[pedidoSeleccionado.estado]}`}>
                {pedidoSeleccionado.estado.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="text-sm text-text-secondary">
                <p><strong className="text-text-primary">Tipo:</strong> {pedidoSeleccionado.tipo}</p>
                {pedidoSeleccionado.mesa && <p><strong className="text-text-primary">Mesa:</strong> {pedidoSeleccionado.mesa.numero}</p>}
                {pedidoSeleccionado.clienteNombre && <p><strong className="text-text-primary">Cliente:</strong> {pedidoSeleccionado.clienteNombre}</p>}
                <p><strong className="text-text-primary">Mozo:</strong> {pedidoSeleccionado.usuario?.nombre}</p>
              </div>

              <div>
                <h3 className="font-semibold text-text-primary mb-2">Items:</h3>
                <div className="space-y-2">
                  {pedidoSeleccionado.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-text-primary">
                        {item.cantidad}x {item.producto?.nombre}
                        {item.observaciones && <span className="text-text-tertiary ml-1">({item.observaciones})</span>}
                      </span>
                      <span className="text-text-primary">${parseFloat(item.subtotal).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border-default pt-3">
                <div className="flex justify-between font-bold text-lg text-text-primary">
                  <span>Total:</span>
                  <span>${parseFloat(pedidoSeleccionado.total).toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Cambiar estado */}
              {!['COBRADO', 'CERRADO', 'CANCELADO'].includes(pedidoSeleccionado.estado) && (
                <div className="border-t border-border-default pt-3">
                  <p className="text-sm font-medium text-text-primary mb-2">Cambiar estado:</p>
                  <div className="flex flex-wrap gap-2">
                    {!esSoloMozo && pedidoSeleccionado.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'EN_PREPARACION')}
                        className="btn btn-primary text-sm"
                      >
                        Iniciar preparacion
                      </button>
                    )}
                    {!esSoloMozo && pedidoSeleccionado.estado === 'EN_PREPARACION' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'LISTO')}
                        className="btn btn-success text-sm"
                      >
                        Marcar listo
                      </button>
                    )}
                    {pedidoSeleccionado.estado === 'LISTO' && (
                      <button
                        onClick={() => cambiarEstado(pedidoSeleccionado.id, 'ENTREGADO')}
                        className="btn btn-primary text-sm"
                      >
                        Marcar entregado
                      </button>
                    )}
                  </div>
                </div>
              )}

              {pedidoSeleccionado.estado === 'COBRADO' && (
                <div className="border-t border-border-default pt-3">
                  <button
                    onClick={() => cerrarPedido(pedidoSeleccionado)}
                    className="btn btn-primary text-sm"
                  >
                    Cerrar pedido
                  </button>
                </div>
              )}

              {pedidoSeleccionado.estado === 'CERRADO' && pedidoSeleccionado.mesaId && (
                <div className="border-t border-border-default pt-3">
                  <button
                    onClick={() => liberarMesa(pedidoSeleccionado.mesaId)}
                    className="btn btn-success text-sm"
                  >
                    Liberar mesa
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setShowModal(false)} className="btn btn-secondary w-full mt-6">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Pago */}
      {showPagoModal && pedidoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="mb-4">
              <h2 className="text-heading-3">Registrar Pago</h2>
              <p className="text-sm text-text-secondary mt-1">
                Pedido #{pedidoSeleccionado.id}
                {pedidoSeleccionado.mesa ? ` · Mesa ${pedidoSeleccionado.mesa.numero}` : ''}
              </p>
            </div>

            {qrPresencial ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">QR presencial listo</p>
                      <p className="text-sm text-text-secondary">
                        {qrPresencial.orderId ? `Orden ${qrPresencial.orderId}` : 'Orden sin identificador'}
                      </p>
                    </div>
                    <span className="badge badge-warning">{qrStatusLabel}</span>
                  </div>

                  <div className="rounded-xl bg-white p-4 border border-border-default flex justify-center">
                    {qrPresencial.qrData ? (
                      <QRCodeSVG value={qrPresencial.qrData} size={220} />
                    ) : (
                      <div className="text-center text-sm text-text-secondary py-8 px-6">
                        Mercado Pago no devolvio el contenido del QR. Usa "Revisar estado" o genera una nueva orden si el cobro fue rechazado.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border-default bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-text-tertiary">Saldo pedido</p>
                      <p className="text-base font-semibold text-text-primary">
                        ${qrPresencial.pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border-default bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-text-tertiary">Propina en QR</p>
                      <p className="text-base font-semibold text-text-primary">
                        ${qrPresencial.propinaMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border-default bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-text-tertiary">Total a cobrar</p>
                      <p className="text-base font-semibold text-text-primary">
                        ${qrPresencial.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border-default bg-white/80 p-3">
                    <QrCodeIcon className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-text-secondary space-y-1">
                      <p>El saldo queda reservado mientras la orden QR siga pendiente.</p>
                      <p>La pantalla revisa el estado automaticamente cada 5 segundos y tambien podes forzar la consulta manual.</p>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={cerrarModalPago} className="btn btn-secondary flex-1">
                    Cerrar
                  </button>
                  <Button
                    type="button"
                    variant="success"
                    className="flex-1"
                    icon={ArrowPathIcon}
                    loading={syncingQr}
                    onClick={() => syncQrStatus()}
                  >
                    Revisar estado
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={registrarPago} className="space-y-4">
                <div>
                  <label className="label" htmlFor="pago-monto">
                    {esQrPresencial ? 'Saldo pendiente ($)' : 'Monto ($)'}
                  </label>
                  <input
                    id="pago-monto"
                    type="number"
                    step="0.01"
                    className="input"
                    value={pagoForm.monto}
                    onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                    readOnly={esQrPresencial}
                    required
                  />
                  {esQrPresencial && (
                    <p className="mt-1 text-xs text-text-secondary">
                      El backend genera la orden usando el saldo pendiente actual del pedido.
                    </p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="pago-metodo">Metodo de Pago</label>
                  <select
                    id="pago-metodo"
                    className="input"
                    value={pagoForm.metodo}
                    onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}
                    disabled={esQrPresencial}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="MERCADOPAGO">MercadoPago</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                  {esQrPresencial && (
                    <p className="mt-1 text-xs text-text-secondary">
                      El QR presencial usa Mercado Pago de forma obligatoria.
                    </p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="pago-canal">Canal de Cobro</label>
                  <select
                    id="pago-canal"
                    className="input"
                    value={pagoForm.canalCobro}
                    onChange={(e) => handleCanalCobroChange(e.target.value)}
                  >
                    <option value="CAJA">Caja</option>
                    <option value="CHECKOUT_WEB">Checkout web</option>
                    <option value="QR_PRESENCIAL">QR presencial</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="pago-propina">Propina ($)</label>
                  <input
                    id="pago-propina"
                    type="number"
                    step="0.01"
                    className="input"
                    value={pagoForm.propinaMonto}
                    onChange={(e) => setPagoForm({
                      ...pagoForm,
                      propinaMonto: e.target.value,
                      propinaMetodo: esQrPresencial ? 'MERCADOPAGO' : pagoForm.propinaMetodo
                    })}
                  />
                </div>

                {pagoForm.propinaMonto && !esQrPresencial && (
                  <div>
                    <label className="label" htmlFor="pago-propina-metodo">Metodo de Propina</label>
                    <select
                      id="pago-propina-metodo"
                      className="input"
                      value={pagoForm.propinaMetodo}
                      onChange={(e) => setPagoForm({ ...pagoForm, propinaMetodo: e.target.value })}
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="MERCADOPAGO">MercadoPago</option>
                      <option value="TARJETA">Tarjeta</option>
                    </select>
                  </div>
                )}

                {pagoForm.propinaMonto && esQrPresencial && (
                  <p className="text-xs text-text-secondary">
                    La propina se incluye en el mismo QR presencial.
                  </p>
                )}

                {pagoForm.metodo === 'EFECTIVO' && !esQrPresencial && (
                  <div>
                    <label className="label" htmlFor="pago-abonado">Monto abonado ($)</label>
                    <input
                      id="pago-abonado"
                      type="number"
                      step="0.01"
                      className="input"
                      value={pagoForm.montoAbonado}
                      onChange={(e) => setPagoForm({ ...pagoForm, montoAbonado: e.target.value })}
                      placeholder="Importe entregado por el cliente"
                    />
                  </div>
                )}

                {pagoForm.metodo !== 'EFECTIVO' && !esQrPresencial && (
                  <div>
                    <label className="label" htmlFor="pago-referencia">Referencia</label>
                    <input
                      id="pago-referencia"
                      type="text"
                      className="input"
                      value={pagoForm.referencia}
                      onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                      placeholder="Numero de transaccion"
                    />
                  </div>
                )}

                <div className="modal-footer">
                  <button type="button" onClick={cerrarModalPago} className="btn btn-secondary flex-1">
                    Cancelar
                  </button>
                  <Button type="submit" variant="success" className="flex-1" loading={generatingQr}>
                    {esQrPresencial ? 'Generar QR presencial' : 'Registrar Pago'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <Modal open={showPreviewModal} onClose={() => setShowPreviewModal(false)} title="Vista previa de caja" size="lg">
        <div className="rounded-xl bg-canvas-subtle border border-border-subtle p-4 overflow-x-auto">
          <pre className="font-mono text-xs text-text-primary whitespace-pre-wrap break-words">
            {previewContent}
          </pre>
        </div>
        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Asignar Delivery */}
      {showAsignarDeliveryModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">Asignar Repartidor</h2>
            <p className="text-sm text-text-secondary mb-4">
              Pedido #{pedidoDeliveryListoId} esta listo. Selecciona un repartidor para la entrega.
            </p>
            {repartidores.length === 0 ? (
              <p className="text-sm text-text-tertiary mb-4">No hay repartidores disponibles.</p>
            ) : (
              <div className="mb-4">
                <label className="label" htmlFor="repartidor-select">Repartidor</label>
                <select
                  id="repartidor-select"
                  className="input"
                  value={repartidorSeleccionado}
                  onChange={(e) => setRepartidorSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar repartidor...</option>
                  {repartidores.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}{r.apellido ? ` ${r.apellido}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setShowAsignarDeliveryModal(false)
                  setPedidoDeliveryListoId(null)
                  deliveryModalPedidoRef.current = null
                  setRepartidorSeleccionado('')
                }}
              >
                Cancelar
              </button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                disabled={!repartidorSeleccionado}
                loading={asignandoDelivery}
                onClick={confirmarAsignarDelivery}
              >
                Asignar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Pedido */}
      <NuevoPedidoModal
        isOpen={showNuevoPedidoModal}
        onClose={() => setShowNuevoPedidoModal(false)}
        onSuccess={() => {
          setShowNuevoPedidoModal(false)
          cargarPedidos()
        }}
      />
    </div>
  )
}
