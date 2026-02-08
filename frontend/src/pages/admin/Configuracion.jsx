import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import {
  Cog6ToothIcon,
  PhotoIcon,
  TruckIcon,
  CreditCardIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  LinkIcon
} from '@heroicons/react/24/outline'
import MercadoPagoConfig from '../../components/configuracion/MercadoPagoConfig'
import useTimeout from '../../hooks/useTimeout'
import useAsync from '../../hooks/useAsync'
import { BACKEND_URL } from '../../config/constants'

export default function Configuracion() {
  // Estado del negocio
  const [negocio, setNegocio] = useState({
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    colorPrimario: '#3B82F6',
    colorSecundario: '#1E40AF'
  })
  const [savingNegocio, setSavingNegocio] = useState(false)

  // Estado de configuracion
  const [config, setConfig] = useState({
    tienda_abierta: true,
    horario_apertura: '11:00',
    horario_cierre: '23:00',
    nombre_negocio: '',
    tagline_negocio: '',
    banner_imagen: '',
    costo_delivery: 0,
    delivery_habilitado: true,
    direccion_retiro: '',
    mercadopago_enabled: false,
    efectivo_enabled: true,
    whatsapp_numero: ''
  })
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [message, setMessage] = useState(null)
  const { set: setMessageTimeout } = useTimeout()

  const mostrarMensaje = useCallback((texto, tipo = 'success') => {
    setMessage({ texto, tipo })
    setMessageTimeout(() => setMessage(null), 3000)
  }, [setMessageTimeout])

  const cargarDatos = useCallback(async () => {
    // Cargar negocio y configuracion en paralelo
    const [negocioRes, configRes] = await Promise.all([
      api.get('/configuracion/negocio', { skipToast: true }),
      api.get('/configuracion', { skipToast: true })
    ])

    // Procesar negocio
    setNegocio({
      nombre: negocioRes.data.nombre || '',
      email: negocioRes.data.email || '',
      telefono: negocioRes.data.telefono || '',
      direccion: negocioRes.data.direccion || '',
      colorPrimario: negocioRes.data.colorPrimario || '#3B82F6',
      colorSecundario: negocioRes.data.colorSecundario || '#1E40AF'
    })

    // Procesar configuracion
    const configData = {}
    Object.entries(configRes.data).forEach(([key, value]) => {
      if (value === 'true') configData[key] = true
      else if (value === 'false') configData[key] = false
      else if (!isNaN(value) && value !== '') configData[key] = parseFloat(value)
      else configData[key] = value
    })
    setConfig(prev => ({ ...prev, ...configData }))
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error al cargar datos:', error)
    mostrarMensaje('Error al cargar configuracion', 'error')
  }, [mostrarMensaje])

  const cargarDatosRequest = useCallback(async (_ctx) => (
    cargarDatos()
  ), [cargarDatos])

  const { loading, execute: cargarDatosAsync } = useAsync(
    cargarDatosRequest,
    { immediate: false, onError: handleLoadError }
  )

  useEffect(() => {
    cargarDatosAsync()
      .catch(() => {})
  }, [cargarDatosAsync])

  const handleNegocioChange = (key, value) => {
    setNegocio(prev => ({ ...prev, [key]: value }))
  }

  const guardarNegocio = async () => {
    setSavingNegocio(true)
    try {
      const response = await api.put('/configuracion/negocio', negocio, { skipToast: true })
      setNegocio(prev => ({ ...prev, ...response.data.negocio }))
      mostrarMensaje('Datos del negocio guardados')
    } catch (error) {
      console.error('Error al guardar negocio:', error)
      mostrarMensaje(error.response?.data?.error?.message || 'Error al guardar', 'error')
    } finally {
      setSavingNegocio(false)
    }
  }

  // Funciones de configuracion
  const guardarConfiguracion = async () => {
    setSaving(true)
    try {
      await api.put('/configuracion', config, { skipToast: true })
      mostrarMensaje('Configuracion guardada correctamente')
    } catch (error) {
      console.error('Error al guardar:', error)
      mostrarMensaje('Error al guardar configuracion', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('banner', file)

    setUploadingBanner(true)
    try {
      const response = await api.post('/configuracion/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true
      })
      setConfig(prev => ({ ...prev, banner_imagen: response.data.url }))
      mostrarMensaje('Banner subido correctamente')
    } catch (error) {
      console.error('Error al subir banner:', error)
      mostrarMensaje('Error al subir banner', 'error')
    } finally {
      setUploadingBanner(false)
    }
  }

  const toggleTiendaAbierta = async () => {
    const nuevoEstado = !config.tienda_abierta
    handleChange('tienda_abierta', nuevoEstado)

    try {
      await api.put('/configuracion/tienda_abierta', { valor: nuevoEstado }, { skipToast: true })
      mostrarMensaje(nuevoEstado ? 'Tienda ABIERTA' : 'Tienda CERRADA')
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      handleChange('tienda_abierta', !nuevoEstado)
      mostrarMensaje('Error al cambiar estado', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 flex items-center gap-2">
          <Cog6ToothIcon className="w-7 h-7" />
          Configuracion del Negocio
        </h1>

        {message && (
          <div className={`alert ${message.tipo === 'error' ? 'alert-error' : 'alert-success'}`}>
            {message.tipo === 'error' ? (
              <XCircleIcon className="w-5 h-5" />
            ) : (
              <CheckCircleIcon className="w-5 h-5" />
            )}
            {message.texto}
          </div>
        )}
      </div>

      {/* Datos del Negocio */}
      <div className="card mb-6">
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          <BuildingStorefrontIcon className="w-5 h-5" />
          Datos del Negocio
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="negocio-nombre">
                Nombre del Negocio *
              </label>
              <input
                id="negocio-nombre"
                type="text"
                value={negocio.nombre}
                onChange={(e) => handleNegocioChange('nombre', e.target.value)}
                className="input"
                placeholder="Mi Restaurante"
              />
            </div>

            <div className="bg-info-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-info-700">
                <LinkIcon className="w-5 h-5" />
                <span className="font-medium">Link del Menú Público</span>
              </div>
              <a
                href={`${frontendUrl}/menu`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info-600 hover:underline text-sm mt-1 block"
              >
                {frontendUrl}/menu
              </a>
              <p className="text-xs text-info-600 mt-2">
                Comparte este link con tus clientes para que vean el menú y hagan pedidos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="negocio-email">
                Email de Contacto
              </label>
              <input
                id="negocio-email"
                type="email"
                value={negocio.email}
                onChange={(e) => handleNegocioChange('email', e.target.value)}
                className="input"
                placeholder="contacto@mirestaurante.com"
              />
            </div>

            <div>
              <label className="label" htmlFor="negocio-telefono">
                Telefono
              </label>
              <input
                id="negocio-telefono"
                type="text"
                value={negocio.telefono}
                onChange={(e) => handleNegocioChange('telefono', e.target.value)}
                className="input"
                placeholder="+54 11 1234-5678"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="negocio-direccion">
              Direccion
            </label>
            <input
              id="negocio-direccion"
              type="text"
              value={negocio.direccion}
              onChange={(e) => handleNegocioChange('direccion', e.target.value)}
              className="input"
              placeholder="Av. Principal 123, Ciudad"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="negocio-color-primario">
                Color Primario
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={negocio.colorPrimario}
                  onChange={(e) => handleNegocioChange('colorPrimario', e.target.value)}
                  className="w-12 h-10 rounded border cursor-pointer"
                  aria-label="Seleccionar color primario"
                />
                <input
                  id="negocio-color-primario"
                  type="text"
                  value={negocio.colorPrimario}
                  onChange={(e) => handleNegocioChange('colorPrimario', e.target.value)}
                  className="input flex-1"
                  placeholder="#3B82F6"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="negocio-color-secundario">
                Color Secundario
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={negocio.colorSecundario}
                  onChange={(e) => handleNegocioChange('colorSecundario', e.target.value)}
                  className="w-12 h-10 rounded border cursor-pointer"
                  aria-label="Seleccionar color secundario"
                />
                <input
                  id="negocio-color-secundario"
                  type="text"
                  value={negocio.colorSecundario}
                  onChange={(e) => handleNegocioChange('colorSecundario', e.target.value)}
                  className="input flex-1"
                  placeholder="#1E40AF"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={guardarNegocio}
              disabled={savingNegocio}
              className={`btn btn-primary px-6 ${savingNegocio ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {savingNegocio ? 'Guardando...' : 'Guardar Datos del Negocio'}
            </button>
          </div>
        </div>
      </div>

      {/* Estado del Local */}
      <div className="card mb-6">
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          Estado del Local
        </h2>

        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <button
            onClick={toggleTiendaAbierta}
            className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
              config.tienda_abierta
                ? 'bg-success-500 hover:bg-success-600 text-white'
                : 'bg-surface-hover hover:bg-border-default text-text-secondary'
            }`}
          >
            {config.tienda_abierta ? 'ABIERTO' : 'CERRADO'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="config-horario-apertura">
              Horario de Apertura
            </label>
            <input
              id="config-horario-apertura"
              type="time"
              value={config.horario_apertura}
              onChange={(e) => handleChange('horario_apertura', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="config-horario-cierre">
              Horario de Cierre
            </label>
            <input
              id="config-horario-cierre"
              type="time"
              value={config.horario_cierre}
              onChange={(e) => handleChange('horario_cierre', e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="card mb-6">
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          <PhotoIcon className="w-5 h-5" />
          Branding
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="config-nombre-negocio">
              Nombre para mostrar en el Menu
            </label>
            <input
              id="config-nombre-negocio"
              type="text"
              value={config.nombre_negocio}
              onChange={(e) => handleChange('nombre_negocio', e.target.value)}
              className="input"
              placeholder="Mi Restaurante"
            />
            <p className="input-hint">
              Se muestra en el menu publico. Si esta vacio, se usa el nombre del negocio.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="config-tagline">
              Tagline / Slogan
            </label>
            <input
              id="config-tagline"
              type="text"
              value={config.tagline_negocio}
              onChange={(e) => handleChange('tagline_negocio', e.target.value)}
              className="input"
              placeholder="Los mejores sabores"
            />
          </div>

          <div>
            <label className="label" htmlFor="config-banner">
              Banner del Menu Publico
            </label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer" htmlFor="config-banner">
                <input
                  id="config-banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
                <span className={`btn ${uploadingBanner ? 'btn-disabled' : 'btn-secondary'}`}>
                  {uploadingBanner ? 'Subiendo...' : 'Subir Banner'}
                </span>
              </label>

              {config.banner_imagen && (
                <div className="flex items-center gap-2">
                  <img
                    src={`${BACKEND_URL}${config.banner_imagen}`}
                    alt="Banner preview"
                    className="h-16 w-32 object-cover rounded-xl border border-border-default"
                  />
                  <button
                    onClick={() => handleChange('banner_imagen', '')}
                    className="text-error-500 hover:text-error-600 text-sm transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
            <p className="input-hint">
              Recomendado: 1200x400 px, JPG o PNG, max 10MB
            </p>
          </div>
        </div>
      </div>

      {/* Delivery */}
      <div className="card mb-6">
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          <TruckIcon className="w-5 h-5" />
          Delivery
        </h2>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.delivery_habilitado}
              onChange={(e) => handleChange('delivery_habilitado', e.target.checked)}
              className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
            />
            <span className="font-medium text-text-primary">Delivery habilitado</span>
          </label>

          <div>
            <label className="label" htmlFor="config-costo-delivery">
              Costo de Envio ($)
            </label>
            <input
              id="config-costo-delivery"
              type="number"
              value={config.costo_delivery || ''}
              onChange={(e) => handleChange('costo_delivery', parseFloat(e.target.value) || 0)}
              className="input"
              min="0"
              step="100"
            />
          </div>

          <div>
            <label className="label" htmlFor="config-direccion-retiro">
              Direccion para Retiro
            </label>
            <input
              id="config-direccion-retiro"
              type="text"
              value={config.direccion_retiro}
              onChange={(e) => handleChange('direccion_retiro', e.target.value)}
              className="input"
              placeholder="Av. Principal 123"
            />
          </div>

          <div>
            <label className="label" htmlFor="config-whatsapp">
              WhatsApp (opcional)
            </label>
            <input
              id="config-whatsapp"
              type="text"
              value={config.whatsapp_numero}
              onChange={(e) => handleChange('whatsapp_numero', e.target.value)}
              className="input"
              placeholder="5411XXXXXXXX"
            />
            <p className="input-hint">
              Codigo de pais + numero sin espacios ni guiones
            </p>
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div className="mb-6">
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          <CreditCardIcon className="w-5 h-5" />
          Metodos de Pago
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* MercadoPago */}
          <MercadoPagoConfig
            onStatusChange={(connected) => handleChange('mercadopago_enabled', connected)}
          />

          {/* Efectivo */}
          <div className="card">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border-subtle">
              <div className="p-2 bg-success-100 rounded-xl">
                <BanknotesIcon className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Efectivo</h3>
                <p className="text-text-secondary text-sm">Pago en efectivo al recibir</p>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.efectivo_enabled}
                  onChange={(e) => handleChange('efectivo_enabled', e.target.checked)}
                  className="w-5 h-5 rounded text-success-500 focus:ring-success-500"
                />
                <span className="font-medium text-text-primary">Aceptar pagos en efectivo</span>
              </label>

              <p className="text-sm text-text-secondary mt-4">
                Los clientes podran elegir pagar en efectivo al momento de recibir su pedido (delivery) o al retirar en el local.
              </p>

              {!config.efectivo_enabled && !config.mercadopago_enabled && (
                <div className="alert alert-warning mt-4">
                  Debes habilitar al menos un metodo de pago para recibir pedidos.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Boton Guardar Configuracion */}
      <div className="flex justify-end">
        <button
          onClick={guardarConfiguracion}
          disabled={saving}
          className={`btn btn-primary px-8 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </button>
      </div>
    </div>
  )
}
