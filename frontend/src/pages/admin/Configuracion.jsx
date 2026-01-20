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
  BanknotesIcon
} from '@heroicons/react/24/outline'
import MercadoPagoConfig from '../../components/configuracion/MercadoPagoConfig'

export default function Configuracion() {
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
    cargarConfiguracion()
  }, [])

  const cargarConfiguracion = async () => {
    try {
      const response = await api.get('/configuracion')
      // Convertir strings a tipos apropiados
      const configData = {}
      Object.entries(response.data).forEach(([key, value]) => {
        if (value === 'true') configData[key] = true
        else if (value === 'false') configData[key] = false
        else if (!isNaN(value) && value !== '') configData[key] = parseFloat(value)
        else configData[key] = value
      })
      setConfig(prev => ({ ...prev, ...configData }))
    } catch (error) {
      console.error('Error al cargar configuración:', error)
      mostrarMensaje('Error al cargar configuración', 'error')
    } finally {
      setLoading(false)
    }
  }

  const mostrarMensaje = (texto, tipo = 'success') => {
    setMessage({ texto, tipo })
    setTimeout(() => setMessage(null), 3000)
  }

  const guardarConfiguracion = async () => {
    setSaving(true)
    try {
      await api.put('/configuracion', config)
      mostrarMensaje('Configuración guardada correctamente')
    } catch (error) {
      console.error('Error al guardar:', error)
      mostrarMensaje('Error al guardar configuración', 'error')
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
      handleChange('tienda_abierta', !nuevoEstado) // Revertir
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Cog6ToothIcon className="w-7 h-7" />
          Configuración del Negocio
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
              Nombre del Negocio
            </label>
            <input
              type="text"
              value={config.nombre_negocio}
              onChange={(e) => handleChange('nombre_negocio', e.target.value)}
              className="input"
              placeholder="Mi Restaurante"
            />
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
              Banner del Menú Público
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
              Costo de Envío ($)
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
              Dirección para Retiro
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
              Código de país + número sin espacios ni guiones
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

      {/* Botón Guardar */}
      <div className="flex justify-end">
        <button
          onClick={guardarConfiguracion}
          disabled={saving}
          className={`btn btn-primary px-8 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  )
}
