import { useState, useEffect } from 'react'
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
  LinkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import MercadoPagoConfig from '../../components/configuracion/MercadoPagoConfig'

export default function Configuracion() {
  // Estado del tenant (datos del negocio)
  const [tenant, setTenant] = useState({
    slug: '',
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    colorPrimario: '#3B82F6',
    colorSecundario: '#1E40AF'
  })
  const [slugError, setSlugError] = useState(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [savingTenant, setSavingTenant] = useState(false)

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      // Cargar tenant y configuracion en paralelo
      const [tenantRes, configRes] = await Promise.all([
        api.get('/tenant'),
        api.get('/configuracion')
      ])

      // Procesar tenant
      setTenant({
        slug: tenantRes.data.slug || '',
        nombre: tenantRes.data.nombre || '',
        email: tenantRes.data.email || '',
        telefono: tenantRes.data.telefono || '',
        direccion: tenantRes.data.direccion || '',
        colorPrimario: tenantRes.data.colorPrimario || '#3B82F6',
        colorSecundario: tenantRes.data.colorSecundario || '#1E40AF'
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
    } catch (error) {
      console.error('Error al cargar datos:', error)
      mostrarMensaje('Error al cargar configuracion', 'error')
    } finally {
      setLoading(false)
    }
  }

  const mostrarMensaje = (texto, tipo = 'success') => {
    setMessage({ texto, tipo })
    setTimeout(() => setMessage(null), 3000)
  }

  // Funciones de tenant
  const handleTenantChange = (key, value) => {
    setTenant(prev => ({ ...prev, [key]: value }))
    if (key === 'slug') {
      setSlugError(null)
    }
  }

  const validateSlugFormat = (slug) => {
    if (!slug || slug.length < 3) return 'El slug debe tener al menos 3 caracteres'
    if (slug.length > 50) return 'El slug no puede tener mas de 50 caracteres'
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 2) {
      return 'Solo minusculas, numeros y guiones (no al inicio ni al final)'
    }
    if (/--/.test(slug)) return 'No puede tener guiones consecutivos'
    return null
  }

  const checkSlugAvailability = async (slug) => {
    const formatError = validateSlugFormat(slug)
    if (formatError) {
      setSlugError(formatError)
      return
    }

    setSlugChecking(true)
    try {
      const response = await api.get(`/tenant/verificar-slug/${slug}`)
      if (!response.data.disponible) {
        setSlugError(response.data.error || 'Este slug no esta disponible')
      } else {
        setSlugError(null)
      }
    } catch (error) {
      console.error('Error al verificar slug:', error)
    } finally {
      setSlugChecking(false)
    }
  }

  const handleSlugBlur = () => {
    if (tenant.slug) {
      checkSlugAvailability(tenant.slug)
    }
  }

  const guardarTenant = async () => {
    // Validar slug
    const formatError = validateSlugFormat(tenant.slug)
    if (formatError) {
      setSlugError(formatError)
      return
    }

    setSavingTenant(true)
    try {
      const response = await api.put('/tenant', tenant)
      setTenant(prev => ({ ...prev, ...response.data.tenant }))

      if (response.data.slugChanged) {
        mostrarMensaje('Datos guardados. La URL del menu cambio a: /menu/' + response.data.tenant.slug)
      } else {
        mostrarMensaje('Datos del negocio guardados')
      }
    } catch (error) {
      console.error('Error al guardar tenant:', error)
      mostrarMensaje(error.response?.data?.error?.message || 'Error al guardar', 'error')
    } finally {
      setSavingTenant(false)
    }
  }

  // Funciones de configuracion
  const guardarConfiguracion = async () => {
    setSaving(true)
    try {
      await api.put('/configuracion', config)
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
        headers: { 'Content-Type': 'multipart/form-data' }
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
      await api.put('/configuracion/tienda_abierta', { valor: nuevoEstado })
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Cog6ToothIcon className="w-7 h-7" />
          Configuracion del Negocio
        </h1>

        {message && (
          <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            message.tipo === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {message.tipo === 'error' ? (
              <XCircleIcon className="w-5 h-5" />
            ) : (
              <CheckCircleIcon className="w-5 h-5" />
            )}
            {message.texto}
          </div>
        )}
      </div>

      {/* Datos del Negocio (Tenant) */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BuildingStorefrontIcon className="w-5 h-5" />
          Datos del Negocio
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Negocio *
              </label>
              <input
                type="text"
                value={tenant.nombre}
                onChange={(e) => handleTenantChange('nombre', e.target.value)}
                className="input"
                placeholder="Mi Restaurante"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del Menu (slug) *
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  {frontendUrl}/menu/
                </span>
                <input
                  type="text"
                  value={tenant.slug}
                  onChange={(e) => handleTenantChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onBlur={handleSlugBlur}
                  className={`input rounded-l-none flex-1 ${slugError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="mi-restaurante"
                />
              </div>
              {slugChecking && (
                <p className="text-xs text-gray-500 mt-1">Verificando disponibilidad...</p>
              )}
              {slugError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3 h-3" />
                  {slugError}
                </p>
              )}
              {!slugError && tenant.slug && !slugChecking && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircleIcon className="w-3 h-3" />
                  URL disponible
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email de Contacto
              </label>
              <input
                type="email"
                value={tenant.email}
                onChange={(e) => handleTenantChange('email', e.target.value)}
                className="input"
                placeholder="contacto@mirestaurante.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono
              </label>
              <input
                type="text"
                value={tenant.telefono}
                onChange={(e) => handleTenantChange('telefono', e.target.value)}
                className="input"
                placeholder="+54 11 1234-5678"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direccion
            </label>
            <input
              type="text"
              value={tenant.direccion}
              onChange={(e) => handleTenantChange('direccion', e.target.value)}
              className="input"
              placeholder="Av. Principal 123, Ciudad"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Primario
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tenant.colorPrimario}
                  onChange={(e) => handleTenantChange('colorPrimario', e.target.value)}
                  className="w-12 h-10 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={tenant.colorPrimario}
                  onChange={(e) => handleTenantChange('colorPrimario', e.target.value)}
                  className="input flex-1"
                  placeholder="#3B82F6"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Secundario
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tenant.colorSecundario}
                  onChange={(e) => handleTenantChange('colorSecundario', e.target.value)}
                  className="w-12 h-10 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={tenant.colorSecundario}
                  onChange={(e) => handleTenantChange('colorSecundario', e.target.value)}
                  className="input flex-1"
                  placeholder="#1E40AF"
                />
              </div>
            </div>
          </div>

          {/* Link al menu publico */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <LinkIcon className="w-5 h-5" />
              <span className="font-medium">Link del Menu Publico:</span>
            </div>
            <a
              href={`${frontendUrl}/menu/${tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm mt-1 block"
            >
              {frontendUrl}/menu/{tenant.slug}
            </a>
            <p className="text-xs text-blue-600 mt-2">
              Comparte este link con tus clientes para que vean el menu y hagan pedidos
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={guardarTenant}
              disabled={savingTenant || !!slugError}
              className={`btn btn-primary px-6 ${(savingTenant || !!slugError) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {savingTenant ? 'Guardando...' : 'Guardar Datos del Negocio'}
            </button>
          </div>
        </div>
      </div>

      {/* Estado del Local */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          Estado del Local
        </h2>

        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <button
            onClick={toggleTiendaAbierta}
            className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
              config.tienda_abierta
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {config.tienda_abierta ? 'ABIERTO' : 'CERRADO'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horario de Apertura
            </label>
            <input
              type="time"
              value={config.horario_apertura}
              onChange={(e) => handleChange('horario_apertura', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horario de Cierre
            </label>
            <input
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <PhotoIcon className="w-5 h-5" />
          Branding
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre para mostrar en el Menu
            </label>
            <input
              type="text"
              value={config.nombre_negocio}
              onChange={(e) => handleChange('nombre_negocio', e.target.value)}
              className="input"
              placeholder="Mi Restaurante"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se muestra en el menu publico. Si esta vacio, se usa el nombre del negocio.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tagline / Slogan
            </label>
            <input
              type="text"
              value={config.tagline_negocio}
              onChange={(e) => handleChange('tagline_negocio', e.target.value)}
              className="input"
              placeholder="Los mejores sabores"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Banner del Menu Publico
            </label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer">
                <input
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
                    src={`${backendUrl}${config.banner_imagen}`}
                    alt="Banner preview"
                    className="h-16 w-32 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => handleChange('banner_imagen', '')}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recomendado: 1200x400 px, JPG o PNG, max 10MB
            </p>
          </div>
        </div>
      </div>

      {/* Delivery */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
            <span className="font-medium text-gray-700">Delivery habilitado</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Costo de Envio ($)
            </label>
            <input
              type="number"
              value={config.costo_delivery || ''}
              onChange={(e) => handleChange('costo_delivery', parseFloat(e.target.value) || 0)}
              className="input"
              min="0"
              step="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direccion para Retiro
            </label>
            <input
              type="text"
              value={config.direccion_retiro}
              onChange={(e) => handleChange('direccion_retiro', e.target.value)}
              className="input"
              placeholder="Av. Principal 123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp (opcional)
            </label>
            <input
              type="text"
              value={config.whatsapp_numero}
              onChange={(e) => handleChange('whatsapp_numero', e.target.value)}
              className="input"
              placeholder="5411XXXXXXXX"
            />
            <p className="text-xs text-gray-500 mt-1">
              Codigo de pais + numero sin espacios ni guiones
            </p>
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCardIcon className="w-5 h-5" />
          Metodos de Pago
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* MercadoPago */}
          <MercadoPagoConfig
            onStatusChange={(connected) => handleChange('mercadopago_enabled', connected)}
          />

          {/* Efectivo */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 text-white">
              <div className="flex items-center gap-3">
                <BanknotesIcon className="w-8 h-8" />
                <div>
                  <h3 className="font-bold text-lg">Efectivo</h3>
                  <p className="text-green-100 text-sm">Pago en efectivo al recibir</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.efectivo_enabled}
                  onChange={(e) => handleChange('efectivo_enabled', e.target.checked)}
                  className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
                />
                <span className="font-medium text-gray-700">Aceptar pagos en efectivo</span>
              </label>

              <p className="text-sm text-gray-600 mt-4">
                Los clientes podran elegir pagar en efectivo al momento de recibir su pedido (delivery) o al retirar en el local.
              </p>

              {!config.efectivo_enabled && !config.mercadopago_enabled && (
                <div className="mt-4 bg-amber-50 text-amber-700 p-3 rounded-lg text-sm">
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
