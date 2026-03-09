import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MapIcon,
  ViewColumnsIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import useAsync from '../../hooks/useAsync'
import usePolling from '../../hooks/usePolling'
import useEventSource from '../../hooks/useEventSource'
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts'
import { EmptyState, PageHeader, Button, Spinner } from '../../components/ui'
import ShortcutsHelp from '../../components/ui/ShortcutsHelp'
import MesaChip from '../../components/plano/MesaChip'
import ZonaDroppable from '../../components/plano/ZonaDroppable'
import { parsePositiveIntParam } from '../../utils/query-params'

const GRUPO_COLORES = [
  'ring-blue-400',
  'ring-purple-400',
  'ring-pink-400',
  'ring-cyan-400',
  'ring-orange-400',
  'ring-teal-400',
]

const FORM_INICIAL = {
  numero: '',
  zona: 'Interior',
  capacidad: 4,
}

export default function Mesas() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esAdmin = usuario?.rol === 'ADMIN'
  const zonaRef = useRef(null)

  const [mesas, setMesas] = useState([])
  const [reservasProximas, setReservasProximas] = useState([])
  const [tab, setTab] = useState('operacion')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)

  const [paredes, setParedes] = useState({ Interior: [], Exterior: [] })
  const [paredesChanged, setParedesChanged] = useState(false)
  const [zonaActiva, setZonaActiva] = useState('Interior')
  const [modoDibujo, setModoDibujo] = useState('mesas')
  const [activeMesa, setActiveMesa] = useState(null)
  const [posicionesModificadas, setPosicionesModificadas] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  const [seleccionGrupo, setSeleccionGrupo] = useState([])
  const mesaEnfocadaId = parsePositiveIntParam(searchParams.get('mesaId'))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const grupoColores = useMemo(() => {
    const colores = {}
    const gruposUnicos = [...new Set(mesas.filter((mesa) => mesa.grupoMesaId).map((mesa) => mesa.grupoMesaId))]
    gruposUnicos.forEach((grupoId, index) => {
      colores[grupoId] = GRUPO_COLORES[index % GRUPO_COLORES.length]
    })
    return colores
  }, [mesas])

  const resetForm = useCallback(() => {
    setForm(FORM_INICIAL)
    setEditando(null)
  }, [])

  const abrirModalNuevaMesa = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  const cerrarModal = useCallback(() => {
    setShowModal(false)
    resetForm()
  }, [resetForm])

  const cargarMesas = useCallback(async () => {
    const response = await api.get('/mesas', { skipToast: true })
    setMesas(response.data)
    return response.data
  }, [])

  const cargarReservas = useCallback(async () => {
    try {
      const response = await api.get('/reservas/proximas', { skipToast: true })
      setReservasProximas(response.data)
    } catch {
      // Reservas es informativo; no bloquea la pantalla.
    }
  }, [])

  const cargarParedes = useCallback(async () => {
    try {
      const [interior, exterior] = await Promise.all([
        api.get('/plano/paredes?zona=Interior', { skipToast: true }),
        api.get('/plano/paredes?zona=Exterior', { skipToast: true })
      ])
      setParedes({ Interior: interior.data, Exterior: exterior.data })
    } catch {
      // La configuracion de paredes puede no existir todavia.
    }
  }, [])

  const refrescar = useCallback(async () => {
    await Promise.all([cargarMesas(), cargarReservas()])
  }, [cargarMesas, cargarReservas])

  const refrescarRequest = useCallback(async () => refrescar(), [refrescar])

  const { loading, execute: refrescarAsync } = useAsync(refrescarRequest, {
    onError: (error) => {
      console.error('Error cargando mesas:', error)
      toast.error('Error al cargar mesas')
    },
  })

  usePolling(refrescarAsync, 30000, { immediate: false })

  useEventSource({
    events: {
      'pedido.updated': refrescarAsync,
      'mesa.updated': refrescarAsync,
      'reserva.updated': refrescarAsync,
    },
  })

  useEffect(() => {
    if (tab !== 'plano') {
      return
    }

    cargarParedes()
  }, [tab, cargarParedes])

  useEffect(() => {
    if (!mesaEnfocadaId || mesas.length === 0) {
      return
    }

    const target = document.getElementById(`mesa-card-${mesaEnfocadaId}`)
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [mesaEnfocadaId, mesas])

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      if (editando) {
        await api.put(`/mesas/${editando.id}`, form, { skipToast: true })
        toast.success('Mesa actualizada')
      } else {
        await api.post('/mesas', form, { skipToast: true })
        toast.success('Mesa creada')
      }

      cerrarModal()
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar mesa')
    }
  }

  const handleEdit = (mesa) => {
    setEditando(mesa)
    setForm({
      numero: mesa.numero,
      zona: mesa.zona || 'Interior',
      capacidad: mesa.capacidad,
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Desactivar esta mesa?')) {
      return
    }

    try {
      await api.delete(`/mesas/${id}`, { skipToast: true })
      toast.success('Mesa desactivada')
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al desactivar mesa')
    }
  }

  const handleDragStart = (event) => {
    const mesa = event.active.data.current?.mesa
    if (mesa) {
      setActiveMesa(mesa)
    }
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

    // Calcular tamanio real del contenedor segun capacidad + rotacion
    const esRectangular = mesa.capacidad >= 6
    const baseW = esRectangular ? 100 : 56
    const baseH = esRectangular ? 48 : 56
    const rotacion = mesa.rotacion || 0
    const esRotado = rotacion === 90 || rotacion === 270
    const chipW = esRotado ? baseH : baseW
    const chipH = esRotado ? baseW : baseH

    // Convertir puntero a posicion top-left del chip
    let newX = pointerX - zonaRect.left - chipW / 2
    let newY = pointerY - zonaRect.top - chipH / 2

    // Clamp dentro de la zona con padding
    const padding = 10
    const minY = 50
    const maxX = zonaRect.width - chipW - padding
    const maxY = zonaRect.height - chipH - padding
    newX = Math.max(padding, Math.min(newX, maxX))
    newY = Math.max(minY, Math.min(newY, maxY))

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

    setPosicionesModificadas(true)
  }

  // ============ PLANO: ACCIONES DE MESA ============

  const handleRotar = (mesaId) => {
    setMesas(prev => prev.map(m => {
      if (m.id !== mesaId) return m
      return { ...m, rotacion: ((m.rotacion || 0) + 90) % 360 }
    }))
    setPosicionesModificadas(true)
  }

  const handleQuitar = (mesaId) => {
    setMesas(prev => prev.map(m => {
      if (m.id !== mesaId) return m
      return { ...m, zona: null, posX: null, posY: null, rotacion: 0 }
    }))
    setPosicionesModificadas(true)
  }

  // ============ PLANO: PAREDES ============

  const handleAgregarPared = (pared) => {
    setParedes(prev => ({
      ...prev,
      [zonaActiva]: [...(prev[zonaActiva] || []), pared]
    }))
    setParedesChanged(true)
    setPosicionesModificadas(true)
  }

  const handleEliminarPared = (paredId) => {
    setParedes(prev => ({
      ...prev,
      [zonaActiva]: (prev[zonaActiva] || []).filter(p => p.id !== paredId)
    }))
    setParedesChanged(true)
    setPosicionesModificadas(true)
  }

  const handleGuardarPosiciones = async () => {
    setSaving(true)
    try {
      const posiciones = mesas
        .filter((mesa) => mesa.posX != null && mesa.posY != null)
        .map(({ id, posX, posY, rotacion, zona }) => ({
          id,
          posX,
          posY,
          rotacion: rotacion || 0,
          zona: zona || 'Interior',
        }))

      if (posiciones.length === 0) {
        toast.error('No hay mesas con posicion asignada')
        setSaving(false)
        return
      }

      const promises = [
        api.patch('/mesas/posiciones', { posiciones }, { skipToast: true })
      ]

      if (paredesChanged) {
        for (const zona of ['Interior', 'Exterior']) {
          promises.push(
            api.put('/plano/paredes', {
              zona,
              paredes: paredes[zona] || []
            }, { skipToast: true })
          )
        }
      }

      await Promise.all(promises)
      toast.success('Posiciones guardadas')
      setPosicionesModificadas(false)
      setParedesChanged(false)
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar posiciones')
    } finally {
      setSaving(false)
    }
  }

  const toggleSeleccionGrupo = (mesaId) => {
    setSeleccionGrupo((prev) =>
      prev.includes(mesaId) ? prev.filter((id) => id !== mesaId) : [...prev, mesaId]
    )
  }

  const handleAgrupar = async () => {
    if (seleccionGrupo.length < 2) {
      toast.error('Selecciona al menos 2 mesas')
      return
    }

    try {
      await api.post('/mesas/grupos', { mesaIds: seleccionGrupo }, { skipToast: true })
      toast.success('Mesas agrupadas')
      setSeleccionGrupo([])
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al agrupar')
    }
  }

  const handleDesagrupar = async (grupoId) => {
    try {
      await api.delete(`/mesas/grupos/${grupoId}`, { skipToast: true })
      toast.success('Grupo eliminado')
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al desagrupar')
    }
  }

  const handlePedirCuenta = async (mesa) => {
    try {
      await api.post(`/mesas/${mesa.id}/precuenta`, {}, { skipToast: true })
      toast.success(`Precuenta solicitada para mesa ${mesa.numero}`)
      refrescarAsync()
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al solicitar precuenta')
    }
  }

  const handleMesaClick = (mesa) => {
    if (mesa.estado === 'LIBRE') {
      if (esAdmin) navigate(`/mozo/nuevo-pedido/${mesa.id}`)
      return
    }

    if (['OCUPADA', 'ESPERANDO_CUENTA', 'CERRADA'].includes(mesa.estado) && mesa.pedidos?.[0]) {
      navigate(`/pedidos?mesaId=${mesa.id}`)
    }
  }

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'LIBRE':
        return 'badge-success'
      case 'OCUPADA':
        return 'badge-error'
      case 'RESERVADA':
        return 'badge-warning'
      case 'ESPERANDO_CUENTA':
        return 'badge-warning'
      case 'CERRADA':
        return 'badge-info'
      default:
        return 'badge-info'
    }
  }

  const getMesaCardTone = (estado) => {
    switch (estado) {
      case 'LIBRE':
        return 'bg-success-50 border-success-200'
      case 'OCUPADA':
        return 'bg-error-50 border-error-200'
      case 'RESERVADA':
        return 'bg-warning-50 border-warning-200'
      case 'ESPERANDO_CUENTA':
        return 'bg-amber-50 border-amber-200'
      case 'CERRADA':
        return 'bg-slate-50 border-slate-200'
      default:
        return ''
    }
  }

  const getReservaProxima = (mesaId) =>
    reservasProximas.find((reserva) => reserva.mesaId === mesaId)

  const formatHora = (fecha) =>
    new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // ============ ATAJOS DE TECLADO ============

  const shortcutsList = useMemo(() => [
    { key: 'N', description: 'Nueva mesa' },
    { key: '1', description: 'Tab Operacion' },
    { key: '2', description: 'Tab Plano' },
    { key: 'Esc', description: 'Cerrar modal / Cancelar' },
    { key: '?', description: 'Ayuda de atajos' },
  ], [])

  useKeyboardShortcuts(useMemo(() => ({
    'n': () => { if (esAdmin) abrirModalNuevaMesa() },
    '1': () => setTab('operacion'),
    '2': () => setTab('plano'),
    'Escape': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false)
      else if (showModal) cerrarModal()
    },
    '?': () => setShowShortcutsHelp(prev => !prev),
  }), [esAdmin, showShortcutsHelp, showModal, abrirModalNuevaMesa, cerrarModal]))

  // ============ VALORES COMPUTADOS ============

  const mesasActivas = useMemo(() => mesas.filter((mesa) => mesa.activa !== false), [mesas])
  const mesasSinPosicionar = useMemo(() => mesasActivas.filter(m => !m.zona || m.posX == null || m.posY == null), [mesasActivas])
  const mesasZonaActiva = useMemo(() => mesasActivas.filter(m => m.zona === zonaActiva && m.posX != null && m.posY != null), [mesasActivas, zonaActiva])
  const { mesasOcupadas, mesasEsperandoCuenta, mesasPorZona } = useMemo(() => ({
    mesasOcupadas: mesasActivas.filter((mesa) => mesa.estado === 'OCUPADA').length,
    mesasEsperandoCuenta: mesasActivas.filter((mesa) => mesa.estado === 'ESPERANDO_CUENTA').length,
    mesasPorZona: mesasActivas.reduce((acc, mesa) => {
      const zona = mesa.zona || 'Sin zona'
      if (!acc[zona]) {
        acc[zona] = []
      }
      acc[zona].push(mesa)
      return acc
    }, {})
  }), [mesasActivas])

  if (loading && mesas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Mesas"
        eyebrow="Salon"
        description="Operacion del salon, plano interactivo y agrupacion de mesas."
        actions={
          <div className="flex items-center gap-2">
            {tab === 'plano' && posicionesModificadas && (
              <Button variant="primary" onClick={handleGuardarPosiciones} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Posiciones'}
              </Button>
            )}
            {tab === 'plano' && esAdmin && (
              <div className="flex gap-1 p-1 bg-surface-hover rounded-lg">
                <button
                  type="button"
                  onClick={() => setModoDibujo('mesas')}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${modoDibujo === 'mesas'
                      ? 'bg-surface shadow-sm text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                    }
                  `}
                >
                  Mover Mesas
                </button>
                <button
                  type="button"
                  onClick={() => setModoDibujo('paredes')}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${modoDibujo === 'paredes'
                      ? 'bg-surface shadow-sm text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                    }
                  `}
                >
                  Dibujar Paredes
                </button>
              </div>
            )}
            {esAdmin && (
              <Button icon={PlusIcon} onClick={abrirModalNuevaMesa}>
                Nueva Mesa
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="stat-card">
          <p className="stat-label">Mesas activas</p>
          <p className="stat-value">{mesasActivas.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Ocupadas</p>
          <p className="stat-value">{mesasOcupadas}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Esperando cuenta</p>
          <p className="stat-value">{mesasEsperandoCuenta}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-border-default">
        <button
          type="button"
          onClick={() => setTab('operacion')}
          className={`tab ${tab === 'operacion' ? 'active' : ''}`}
        >
          <ViewColumnsIcon className="w-4 h-4" />
          Operacion
        </button>
        <button
          type="button"
          onClick={() => setTab('plano')}
          className={`tab ${tab === 'plano' ? 'active' : ''}`}
        >
          <MapIcon className="w-4 h-4" />
          Plano
        </button>
      </div>

      {tab === 'operacion' && (
        <div>
          <div className="mb-5 flex flex-wrap gap-4 text-sm text-text-secondary">
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
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-100 border border-amber-200"></div>
              <span>Esperando cuenta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div>
              <span>Cerrada</span>
            </div>
          </div>

          {seleccionGrupo.length > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
              <span className="text-sm text-text-secondary">
                {seleccionGrupo.length} mesas seleccionadas
              </span>
              <Button size="sm" onClick={handleAgrupar}>
                Agrupar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSeleccionGrupo([])}>
                Cancelar
              </Button>
            </div>
          )}

          {mesasActivas.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No hay mesas configuradas"
                description="Crea la primera mesa para habilitar operacion y plano."
                actionLabel="Crear primera mesa"
                onAction={abrirModalNuevaMesa}
              />
            </div>
          ) : (
            Object.entries(mesasPorZona).map(([zona, mesasZona]) => (
              <div key={zona} className="mb-8">
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-heading-3 text-text-secondary">{zona}</h2>
                    <p className="text-body-sm">
                      {mesasZona.length} mesa{mesasZona.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                  {mesasZona.map((mesa) => {
                    const reservaProxima = getReservaProxima(mesa.id)
                    const isSelected = seleccionGrupo.includes(mesa.id)

                    return (
                      <div
                        id={`mesa-card-${mesa.id}`}
                        key={mesa.id}
                        className={`
                          card card-hover relative cursor-pointer transition-all text-left
                          ${!mesa.activa ? 'opacity-50' : ''}
                          ${isSelected ? 'ring-2 ring-primary-500' : ''}
                          ${mesa.id === mesaEnfocadaId ? 'ring-2 ring-primary-300 shadow-lg' : ''}
                          ${getMesaCardTone(mesa.estado)}
                          ${grupoColores[mesa.grupoMesaId] ? `ring-2 ring-offset-1 ${grupoColores[mesa.grupoMesaId]}` : ''}
                        `}
                        onClick={() => handleMesaClick(mesa)}
                      >
                        {reservaProxima && (
                          <div
                            className="absolute -top-2 -right-2 bg-warning-500 text-white rounded-full p-1"
                            title={`Reserva a las ${formatHora(reservaProxima.fechaHora)} - ${reservaProxima.clienteNombre}`}
                          >
                            <CalendarDaysIcon className="w-4 h-4" />
                          </div>
                        )}

                        {esAdmin && mesa.grupoMesaId && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDesagrupar(mesa.grupoMesaId)
                            }}
                            className="absolute -top-2 -left-2 bg-surface border border-border-default text-text-tertiary rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-error-50 hover:text-error-500 transition-colors"
                            title="Desagrupar"
                          >
                            &times;
                          </button>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-3xl font-bold text-text-primary">{mesa.numero}</div>
                            <p className="mt-1 text-xs text-text-tertiary">{mesa.capacidad} personas</p>
                          </div>
                          <span className={`badge ${getEstadoBadge(mesa.estado)}`}>{mesa.estado}</span>
                        </div>

                        {mesa.estado === 'OCUPADA' && mesa.pedidos?.[0] && (
                          <div className="mt-3 text-xs text-text-tertiary">
                            Pedido #{mesa.pedidos[0].id}
                          </div>
                        )}

                        {reservaProxima && mesa.estado === 'LIBRE' && (
                          <div className="mt-1 text-xs font-medium text-warning-700">
                            Reserva {formatHora(reservaProxima.fechaHora)}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {mesa.estado === 'OCUPADA' && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handlePedirCuenta(mesa)
                              }}
                              className="mesa-primary-action"
                              title={`Solicitar cuenta para mesa ${mesa.numero}`}
                            >
                              Cuenta
                            </button>
                          )}
                          {esAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleEdit(mesa)
                                }}
                                aria-label={`Editar mesa ${mesa.numero}`}
                                title={`Editar mesa ${mesa.numero}`}
                                className="mesa-action-btn mesa-action-btn--primary"
                              >
                                <PencilIcon className="w-4 h-4" />
                                <span className="hidden xl:inline">Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  toggleSeleccionGrupo(mesa.id)
                                }}
                                aria-label={`Seleccionar mesa ${mesa.numero} para agrupar`}
                                title={`Seleccionar mesa ${mesa.numero} para agrupar`}
                                className={`mesa-action-btn ${
                                  isSelected
                                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                                    : 'text-text-tertiary hover:text-text-secondary'
                                }`}
                              >
                                <ViewColumnsIcon className="w-4 h-4" />
                                <span className="hidden xl:inline">Agrupar</span>
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleDelete(mesa.id)
                                }}
                                aria-label={`Desactivar mesa ${mesa.numero}`}
                                title={`Desactivar mesa ${mesa.numero}`}
                                className="mesa-action-btn mesa-action-btn--danger"
                              >
                                <TrashIcon className="w-4 h-4" />
                                <span className="hidden xl:inline">Baja</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'plano' && (
        <div className="space-y-4">
          {/* Tabs de zonas */}
          <div className="flex gap-1 p-1 bg-surface-hover rounded-lg w-fit">
            {['Interior', 'Exterior'].map(zona => (
              <button
                key={zona}
                type="button"
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
                  ({mesasActivas.filter(m => m.zona === zona && m.posX != null).length})
                </span>
              </button>
            ))}
          </div>

          {modoDibujo === 'paredes' && (
            <p className="text-xs text-text-tertiary">
              Click para iniciar una pared, click de nuevo para terminarla. Click derecho o Esc para cancelar. Shift para lineas rectas.
            </p>
          )}

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
                      onEditar={handleEdit}
                      enGrupo={mesa.grupoMesaId != null}
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
              onEditar={handleEdit}
              paredes={paredes[zonaActiva] || []}
              modoPlano={modoDibujo}
              onAgregarPared={handleAgregarPared}
              onEliminarPared={handleEliminarPared}
            />

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
              {activeMesa ? (
                <MesaChip mesa={activeMesa} isDragging disabled enGrupo={activeMesa.grupoMesaId != null} />
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
              <div className="w-4 h-4 rounded bg-amber-100 border border-amber-400" />
              <span>Esperando Cuenta</span>
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
        </div>
      )}

      <ShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        shortcuts={shortcutsList}
        pageName="Mesas"
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-heading-3 mb-4">{editando ? 'Editar Mesa' : 'Nueva Mesa'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="mesa-numero">
                  Numero de Mesa
                </label>
                <input
                  id="mesa-numero"
                  type="number"
                  className="input"
                  value={form.numero}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm((prev) => ({
                      ...prev,
                      numero: value === '' ? '' : parseInt(value, 10),
                    }))
                  }}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="mesa-zona">
                  Zona
                </label>
                <select
                  id="mesa-zona"
                  className="input"
                  value={form.zona}
                  onChange={(event) => setForm((prev) => ({ ...prev, zona: event.target.value }))}
                >
                  <option value="Interior">Interior</option>
                  <option value="Exterior">Exterior</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="mesa-capacidad">
                  Capacidad
                </label>
                <input
                  id="mesa-capacidad"
                  type="number"
                  className="input"
                  value={form.capacidad}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm((prev) => ({
                      ...prev,
                      capacidad: value === '' ? '' : parseInt(value, 10),
                    }))
                  }}
                  min="1"
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={cerrarModal} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
