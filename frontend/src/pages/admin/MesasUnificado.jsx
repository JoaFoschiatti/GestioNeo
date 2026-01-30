import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import useAsync from '../../hooks/useAsync'
import usePolling from '../../hooks/usePolling'
import useEventSource from '../../hooks/useEventSource'
import MesaChip from '../../components/plano/MesaChip'
import ZonaDroppable from '../../components/plano/ZonaDroppable'
import {
  PlusIcon,
  XMarkIcon,
  CalendarDaysIcon,
  ExclamationCircleIcon,
  Squares2X2Icon,
  MapIcon
} from '@heroicons/react/24/outline'

const ZONAS = ['Interior', 'Exterior']
const CAPACIDADES = [2, 4, 6, 8, 10, 12]

export default function MesasUnificado() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [mesas, setMesas] = useState([])
  const [reservasProximas, setReservasProximas] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [reservasError, setReservasError] = useState(null)

  // Tab principal: 'operacion' o 'plano'
  const [tabActivo, setTabActivo] = useState('operacion')

  // Estado para el tab Plano
  const [zonaActiva, setZonaActiva] = useState('Interior')
  const [activeMesa, setActiveMesa] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const zonaRef = useRef(null)

  // Estado del modal
  const [showModal, setShowModal] = useState(false)
  const [mesaEditando, setMesaEditando] = useState(null)
  const [form, setForm] = useState({ numero: '', capacidad: 4 })
  const [submitting, setSubmitting] = useState(false)

  const esAdmin = usuario?.rol === 'ADMIN'

  // Sensor con activación mínima para evitar clicks accidentales
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  // ============ CARGA DE DATOS ============

  const cargarMesas = useCallback(async () => {
    try {
      const response = await api.get('/mesas?activa=true', { skipToast: true })
      setMesas(response.data)
      setHasChanges(false)
      setLoadError(null)
      return response.data
    } catch (error) {
      console.error('Error:', error)
      setLoadError('No pudimos cargar las mesas.')
      throw error
    }
  }, [])

  const cargarReservasProximas = useCallback(async () => {
    try {
      const response = await api.get('/reservas/proximas', { skipToast: true })
      setReservasProximas(response.data)
      setReservasError(null)
    } catch (error) {
      console.error('Error:', error)
      setReservasError('No pudimos cargar las reservas próximas.')
    }
  }, [])

  const refrescar = useCallback(async () => {
    await Promise.all([cargarMesas(), cargarReservasProximas()])
  }, [cargarMesas, cargarReservasProximas])

  const handleLoadError = useCallback(() => {
    // Error already handled in cargarMesas
  }, [])

  const { loading, execute: recargar } = useAsync(
    useCallback(async () => refrescar(), [refrescar]),
    { onError: handleLoadError }
  )

  usePolling(recargar, 30000, { immediate: false })

  useEventSource({
    events: {
      'pedido.updated': recargar,
      'mesa.updated': recargar,
      'reserva.updated': recargar
    }
  })

  // ============ HELPERS ============

  const getReservaProxima = (mesaId) => {
    return reservasProximas.find(r => r.mesaId === mesaId)
  }

  const formatHora = (fecha) => {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstadoStyle = (estado) => {
    switch (estado) {
      case 'LIBRE':
        return 'bg-success-50 border-success-200 hover:bg-success-100'
      case 'OCUPADA':
        return 'bg-error-50 border-error-200 hover:bg-error-100'
      case 'RESERVADA':
        return 'bg-warning-50 border-warning-200 hover:bg-warning-100'
      default:
        return 'bg-surface-hover border-border-subtle'
    }
  }

  // ============ OPERACIÓN: CLICK EN MESA ============

  const handleMesaClick = (mesa) => {
    if (mesa.estado === 'LIBRE') {
      navigate(`/mozo/nuevo-pedido/${mesa.id}`)
    } else if (mesa.estado === 'OCUPADA') {
      if (mesa.pedidos?.[0]) {
        navigate(`/pedidos?mesaId=${mesa.id}`)
      }
    }
  }

  const handleRetry = () => {
    setLoadError(null)
    recargar()
  }

  // ============ CRUD ============

  const abrirModalCrear = () => {
    setMesaEditando(null)
    setForm({ numero: '', capacidad: 4 })
    setShowModal(true)
  }

  const abrirModalEditar = (mesa) => {
    setMesaEditando(mesa)
    setForm({ numero: mesa.numero, capacidad: mesa.capacidad })
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setMesaEditando(null)
    setForm({ numero: '', capacidad: 4 })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.numero) {
      toast.error('El número de mesa es requerido')
      return
    }

    setSubmitting(true)
    try {
      if (mesaEditando) {
        await api.put(`/mesas/${mesaEditando.id}`, {
          numero: parseInt(form.numero),
          capacidad: parseInt(form.capacidad)
        }, { skipToast: true })
        toast.success('Mesa actualizada')
      } else {
        await api.post('/mesas', {
          numero: parseInt(form.numero),
          capacidad: parseInt(form.capacidad)
        }, { skipToast: true })
        toast.success('Mesa creada')
      }
      cerrarModal()
      recargar()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar mesa')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminar = async () => {
    if (!mesaEditando) return
    if (!confirm(`¿Eliminar mesa ${mesaEditando.numero}?`)) return

    setSubmitting(true)
    try {
      await api.delete(`/mesas/${mesaEditando.id}`, { skipToast: true })
      toast.success('Mesa eliminada')
      cerrarModal()
      recargar()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al eliminar mesa')
    } finally {
      setSubmitting(false)
    }
  }

  // ============ DRAG & DROP (PLANO) ============

  const handleDragStart = (event) => {
    const mesa = event.active.data.current?.mesa
    setActiveMesa(mesa)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveMesa(null)

    if (!esAdmin) return

    const mesa = active.data.current?.mesa
    if (!mesa) return

    const zonaElement = zonaRef.current
    if (!zonaElement) return

    const zonaRect = zonaElement.getBoundingClientRect()
    const pointerX = event.activatorEvent?.clientX + (event.delta?.x || 0)
    const pointerY = event.activatorEvent?.clientY + (event.delta?.y || 0)

    let newX = pointerX - zonaRect.left - 32
    let newY = pointerY - zonaRect.top - 32

    const maxX = zonaRect.width - 120
    const maxY = zonaRect.height - 80
    newX = Math.max(10, Math.min(newX, maxX))
    newY = Math.max(50, Math.min(newY, maxY))

    const targetZona = over?.data.current?.zona

    setMesas(prev => prev.map(m => {
      if (m.id !== mesa.id) return m

      if (targetZona === zonaActiva) {
        return { ...m, zona: zonaActiva, posX: Math.round(newX), posY: Math.round(newY) }
      }

      if (m.zona === zonaActiva && m.posX != null) {
        return { ...m, posX: Math.round(newX), posY: Math.round(newY) }
      }

      return m
    }))

    setHasChanges(true)
  }

  const handleRotar = (mesaId) => {
    setMesas(prev => prev.map(m => {
      if (m.id !== mesaId) return m
      const nuevaRotacion = ((m.rotacion || 0) + 90) % 360
      return { ...m, rotacion: nuevaRotacion }
    }))
    setHasChanges(true)
  }

  const handleQuitar = (mesaId) => {
    setMesas(prev => prev.map(m => {
      if (m.id !== mesaId) return m
      return { ...m, zona: null, posX: null, posY: null, rotacion: 0 }
    }))
    setHasChanges(true)
  }

  const handleGuardarPosiciones = async () => {
    const posiciones = mesas.map(m => ({
      id: m.id,
      zona: m.zona || null,
      posX: m.posX ?? null,
      posY: m.posY ?? null,
      rotacion: m.rotacion || 0
    }))

    setSaving(true)
    try {
      await api.patch('/mesas/posiciones', { posiciones }, { skipToast: true })
      toast.success('Posiciones guardadas')
      setHasChanges(false)
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar posiciones')
    } finally {
      setSaving(false)
    }
  }

  const contarMesasZona = (zona) => mesas.filter(m => m.zona === zona && m.posX != null).length

  // Separar mesas por zona para el tab Plano
  const mesasSinPosicionar = mesas.filter(m => !m.zona || m.posX == null || m.posY == null)
  const mesasZonaActiva = mesas.filter(m => m.zona === zonaActiva && m.posX != null && m.posY != null)

  // Agrupar mesas por zona para el tab Operación
  const mesasPorZona = mesas.reduce((acc, mesa) => {
    const zona = mesa.zona || 'Sin zona'
    if (!acc[zona]) acc[zona] = []
    acc[zona].push(mesa)
    return acc
  }, {})

  // ============ RENDER ============

  if (loading && mesas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }

  if (loadError && mesas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ExclamationCircleIcon className="w-10 h-10 text-error-500 mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No pudimos cargar las mesas</h2>
        <p className="text-sm text-text-secondary mb-4">{loadError}</p>
        <button type="button" onClick={handleRetry} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Errores */}
      {loadError && mesas.length > 0 && (
        <div className="bg-error-50 text-error-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{loadError}</span>
          <button type="button" onClick={handleRetry} className="text-sm font-medium hover:underline">
            Reintentar
          </button>
        </div>
      )}
      {reservasError && (
        <div className="bg-warning-50 text-warning-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="flex-1 text-sm">{reservasError}</span>
          <button type="button" onClick={cargarReservasProximas} className="text-sm font-medium hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mesas</h1>
          <p className="text-text-secondary text-sm mt-1">
            {tabActivo === 'operacion'
              ? 'Gestiona pedidos y estados de mesas'
              : esAdmin
                ? 'Organiza las mesas de tu local'
                : 'Vista de la disposición de mesas'
            }
          </p>
        </div>
        <div className="flex gap-2">
          {tabActivo === 'operacion' && (
            <button
              onClick={() => navigate('/mozo/nuevo-pedido')}
              className="btn btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Pedido Delivery/Mostrador</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}
          {tabActivo === 'plano' && esAdmin && (
            <>
              <button onClick={abrirModalCrear} className="btn btn-secondary">
                <PlusIcon className="w-5 h-5 mr-1" />
                Nueva Mesa
              </button>
              {hasChanges && (
                <button
                  onClick={handleGuardarPosiciones}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Guardando...' : 'Guardar Posiciones'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1 p-1 bg-surface-hover rounded-lg w-fit">
        <button
          onClick={() => setTabActivo('operacion')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2
            ${tabActivo === 'operacion'
              ? 'bg-surface shadow-sm text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
            }
          `}
        >
          <Squares2X2Icon className="w-4 h-4" />
          Operación
        </button>
        <button
          onClick={() => setTabActivo('plano')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2
            ${tabActivo === 'plano'
              ? 'bg-surface shadow-sm text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
            }
          `}
        >
          <MapIcon className="w-4 h-4" />
          Plano
        </button>
      </div>

      {/* ============ TAB OPERACIÓN ============ */}
      {tabActivo === 'operacion' && (
        <div>
          {/* Leyenda */}
          <div className="flex gap-4 mb-6 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success-100 border border-success-200"></div>
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-error-100 border border-error-200"></div>
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-warning-100 border border-warning-200"></div>
              <span>Reservada</span>
            </div>
          </div>

          {Object.entries(mesasPorZona).map(([zona, mesasZona]) => (
            <div key={zona} className="mb-8">
              <h2 className="text-lg font-semibold text-text-secondary mb-4">{zona}</h2>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {mesasZona.map((mesa) => {
                  const reservaProxima = getReservaProxima(mesa.id)
                  return (
                    <button
                      key={mesa.id}
                      onClick={() => handleMesaClick(mesa)}
                      className={`p-4 rounded-xl border transition-all relative ${getEstadoStyle(mesa.estado)}`}
                    >
                      {reservaProxima && (
                        <div className="absolute -top-2 -right-2 bg-warning-500 text-white rounded-full p-1" title={`Reserva a las ${formatHora(reservaProxima.fechaHora)} - ${reservaProxima.clienteNombre}`}>
                          <CalendarDaysIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="text-3xl font-bold text-text-primary mb-1">
                        {mesa.numero}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {mesa.capacidad} personas
                      </div>
                      {mesa.estado === 'OCUPADA' && mesa.pedidos?.[0] && (
                        <div className="text-xs text-text-tertiary mt-2">
                          Pedido #{mesa.pedidos[0].id}
                        </div>
                      )}
                      {reservaProxima && mesa.estado === 'LIBRE' && (
                        <div className="text-xs text-warning-600 mt-2 font-medium">
                          Reserva {formatHora(reservaProxima.fechaHora)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ TAB PLANO ============ */}
      {tabActivo === 'plano' && (
        <>
          {/* Tabs de zonas */}
          <div className="flex gap-1 p-1 bg-surface-hover rounded-lg w-fit">
            {ZONAS.map(zona => (
              <button
                key={zona}
                onClick={() => setZonaActiva(zona)}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all
                  ${zonaActiva === zona
                    ? 'bg-surface shadow-sm text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                {zona}
                <span className="ml-2 text-xs opacity-60">
                  ({contarMesasZona(zona)})
                </span>
              </button>
            ))}
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Mesas sin posicionar */}
            {mesasSinPosicionar.length > 0 && esAdmin && (
              <div className="card p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  Mesas sin posicionar ({mesasSinPosicionar.length})
                </h3>
                <div className="flex flex-wrap gap-4">
                  {mesasSinPosicionar.map(mesa => (
                    <MesaChip
                      key={mesa.id}
                      mesa={mesa}
                      showActions
                      onEditar={abrirModalEditar}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Zona activa */}
            <ZonaDroppable
              ref={zonaRef}
              zona={zonaActiva}
              mesas={mesasZonaActiva}
              disabled={!esAdmin}
              onRotar={handleRotar}
              onQuitar={handleQuitar}
              onEditar={abrirModalEditar}
            />

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
              {activeMesa ? (
                <MesaChip mesa={activeMesa} isDragging disabled />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            <span className="font-medium">Estado:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success-100 border border-success-300" />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-error-100 border border-error-300" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-warning-100 border border-warning-300" />
              <span>Reservada</span>
            </div>
            <span className="mx-2 text-border-default">|</span>
            <span className="font-medium">Forma:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-surface border border-border-default" />
              <span>4 personas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-3 rounded bg-surface border border-border-default" />
              <span>6+ personas</span>
            </div>
          </div>
        </>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={cerrarModal} />
          <div className="relative bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {mesaEditando ? `Editar Mesa #${mesaEditando.numero}` : 'Nueva Mesa'}
              </h2>
              <button
                onClick={cerrarModal}
                className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Número de mesa
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  className="input w-full"
                  placeholder="Ej: 1, 2, 3..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Capacidad (personas)
                </label>
                <select
                  value={form.capacidad}
                  onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                  className="input w-full"
                >
                  {CAPACIDADES.map(cap => (
                    <option key={cap} value={cap}>{cap} personas</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                {mesaEditando && (
                  <button
                    type="button"
                    onClick={handleEliminar}
                    disabled={submitting}
                    className="btn btn-error mr-auto"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="btn btn-secondary ml-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Guardando...' : mesaEditando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
