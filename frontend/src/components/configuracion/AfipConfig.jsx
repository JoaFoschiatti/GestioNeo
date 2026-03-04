import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import useAsync from '../../hooks/useAsync'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

const CONDICION_IVA_OPTIONS = [
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' }
]

export default function AfipConfig() {
  const [estado, setEstado] = useState(null)
  const [fiscal, setFiscal] = useState({
    cuit: '',
    razonSocial: '',
    condicionIva: '',
    puntoVenta: '',
    domicilioFiscal: '',
    iibb: '',
    inicioActividades: ''
  })
  const [savingFiscal, setSavingFiscal] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [testing, setTesting] = useState(false)
  const [togglingModo, setTogglingModo] = useState(false)
  const [message, setMessage] = useState(null)
  const [certFile, setCertFile] = useState(null)
  const [keyFile, setKeyFile] = useState(null)
  const [testResult, setTestResult] = useState(null)

  // CSR generation flow
  const [csrMode, setCsrMode] = useState(true)
  const [csrAlias, setCsrAlias] = useState('')
  const [csrCuit, setCsrCuit] = useState('')
  const [csrRazonSocial, setCsrRazonSocial] = useState('')
  const [generatingCsr, setGeneratingCsr] = useState(false)
  const [csrPem, setCsrPem] = useState(null)
  const [soloCrtFile, setSoloCrtFile] = useState(null)
  const [uploadingSoloCrt, setUploadingSoloCrt] = useState(false)

  const cargarEstado = useCallback(async () => {
    const response = await api.get('/afip/estado', { skipToast: true })
    const data = response.data
    setEstado(data)
    setFiscal({
      cuit: data.fiscal?.cuit || '',
      razonSocial: data.fiscal?.razonSocial || '',
      condicionIva: data.fiscal?.condicionIva || '',
      puntoVenta: data.fiscal?.puntoVenta || '',
      domicilioFiscal: data.fiscal?.domicilioFiscal || '',
      iibb: data.fiscal?.iibb || '',
      inicioActividades: data.fiscal?.inicioActividades
        ? new Date(data.fiscal.inicioActividades).toISOString().split('T')[0]
        : ''
    })
    // Pre-populate CSR fields
    setCsrCuit(data.fiscal?.cuit || '')
    setCsrRazonSocial(data.fiscal?.razonSocial || '')
    // Auto-enter CSR mode if pending
    if (data.afip?.csrPendiente) {
      setCsrMode(true)
    }
    return data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error al cargar estado AFIP:', error)
    setMessage({ texto: 'Error al cargar estado AFIP', tipo: 'error' })
  }, [])

  const cargarEstadoRequest = useCallback(async (_ctx) => (
    cargarEstado()
  ), [cargarEstado])

  const { loading, execute: cargarEstadoAsync } = useAsync(
    cargarEstadoRequest,
    { onError: handleLoadError }
  )

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  const guardarFiscal = async () => {
    setSavingFiscal(true)
    try {
      const data = { ...fiscal }
      if (data.puntoVenta) data.puntoVenta = parseInt(data.puntoVenta, 10)
      await api.put('/afip/fiscal', data, { skipToast: true })
      setMessage({ texto: 'Datos fiscales guardados', tipo: 'success' })
      cargarEstadoAsync()
    } catch (error) {
      setMessage({
        texto: error.response?.data?.error?.message || 'Error al guardar datos fiscales',
        tipo: 'error'
      })
    } finally {
      setSavingFiscal(false)
    }
  }

  // --- Manual upload (ambos archivos) ---
  const subirCertificado = async () => {
    if (!certFile || !keyFile) {
      setMessage({ texto: 'Selecciona ambos archivos: certificado (.crt) y clave privada (.key)', tipo: 'error' })
      return
    }

    setUploadingCert(true)
    try {
      const formData = new FormData()
      formData.append('certificado', certFile)
      formData.append('clavePrivada', keyFile)

      await api.post('/afip/certificado', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true
      })
      setMessage({ texto: 'Certificados AFIP actualizados correctamente', tipo: 'success' })
      setCertFile(null)
      setKeyFile(null)
      cargarEstadoAsync()
    } catch (error) {
      setMessage({
        texto: error.response?.data?.error?.message || 'Error al subir certificados',
        tipo: 'error'
      })
    } finally {
      setUploadingCert(false)
    }
  }

  // --- CSR flow ---
  const generarCsr = async () => {
    if (!csrCuit || !csrAlias) {
      setMessage({ texto: 'CUIT y Alias son requeridos para generar el CSR', tipo: 'error' })
      return
    }
    setGeneratingCsr(true)
    try {
      const body = { cuit: csrCuit, alias: csrAlias }
      if (csrRazonSocial) body.razonSocial = csrRazonSocial
      const response = await api.post('/afip/csr', body, { skipToast: true })
      setCsrPem(response.data.csrPem)
      setMessage({ texto: 'CSR generado. Descargalo y subilo al portal de AFIP.', tipo: 'success' })
      cargarEstadoAsync()
    } catch (error) {
      setMessage({
        texto: error.response?.data?.error?.message || 'Error al generar CSR',
        tipo: 'error'
      })
    } finally {
      setGeneratingCsr(false)
    }
  }

  const descargarCsr = () => {
    if (!csrPem) return
    const blob = new Blob([csrPem], { type: 'application/x-pem-file' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comanda_afip_${csrAlias || 'csr'}.pem`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const subirSoloCrt = async () => {
    if (!soloCrtFile) {
      setMessage({ texto: 'Selecciona el archivo de certificado (.crt)', tipo: 'error' })
      return
    }
    setUploadingSoloCrt(true)
    try {
      const formData = new FormData()
      formData.append('certificado', soloCrtFile)
      await api.post('/afip/certificado/solo-crt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true
      })
      setMessage({ texto: 'Certificado vinculado correctamente', tipo: 'success' })
      setSoloCrtFile(null)
      setCsrPem(null)
      cargarEstadoAsync()
    } catch (error) {
      setMessage({
        texto: error.response?.data?.error?.message || 'Error al subir certificado',
        tipo: 'error'
      })
    } finally {
      setUploadingSoloCrt(false)
    }
  }

  // --- Test & Mode ---
  const testConexion = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await api.post('/afip/test', {}, { skipToast: true })
      setTestResult(response.data)
      setMessage({
        texto: response.data.ok ? 'Conexion AFIP exitosa' : 'Error en conexion AFIP',
        tipo: response.data.ok ? 'success' : 'error'
      })
    } catch (error) {
      setTestResult({ ok: false, message: error.response?.data?.error?.message || 'Error de conexion' })
      setMessage({ texto: 'Error al probar conexion', tipo: 'error' })
    } finally {
      setTesting(false)
    }
  }

  const toggleModo = async () => {
    const nuevoModo = !estado?.afip?.produccion
    if (nuevoModo && !confirm('Cambiar a modo Produccion? Las facturas seran reales y tendran validez fiscal.')) {
      return
    }
    setTogglingModo(true)
    try {
      await api.put('/afip/modo', { produccion: nuevoModo }, { skipToast: true })
      setMessage({
        texto: `Modo cambiado a ${nuevoModo ? 'Produccion' : 'Homologacion'}`,
        tipo: 'success'
      })
      cargarEstadoAsync()
    } catch (error) {
      setMessage({
        texto: error.response?.data?.error?.message || 'Error al cambiar modo',
        tipo: 'error'
      })
    } finally {
      setTogglingModo(false)
    }
  }

  if (loading && !estado) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <ArrowPathIcon className="w-6 h-6 animate-spin text-text-tertiary" />
          <span className="text-text-secondary">Cargando configuracion AFIP...</span>
        </div>
      </div>
    )
  }

  const configurado = estado?.afip?.configurado
  const produccion = estado?.afip?.produccion
  const csrPendiente = estado?.afip?.csrPendiente

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${configurado ? 'bg-success-100' : 'bg-warning-100'}`}>
            <ShieldCheckIcon className={`w-6 h-6 ${configurado ? 'text-success-600' : 'text-warning-600'}`} />
          </div>
          <div>
            <h3 className="font-bold text-text-primary">AFIP - Facturacion Electronica</h3>
            <p className="text-text-secondary text-sm">
              {configurado ? 'Configurado' : 'No configurado'} -
              Modo {produccion ? 'Produccion' : 'Homologacion'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {configurado && (
            <span className={`badge ${estado?.afip?.tokenVigente ? 'badge-success' : 'badge-warning'}`}>
              {estado?.afip?.tokenVigente ? 'Token vigente' : 'Token expirado'}
            </span>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${
          message.tipo === 'error' ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700'
        }`}>
          {message.tipo === 'error' ? (
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
          ) : (
            <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{message.texto}</span>
          <button onClick={() => setMessage(null)} className="ml-auto">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Datos Fiscales */}
      <div className="mb-6">
        <h4 className="font-semibold text-text-primary mb-3">Datos Fiscales</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="afip-cuit">CUIT</label>
            <input
              id="afip-cuit"
              type="text"
              value={fiscal.cuit}
              onChange={(e) => setFiscal(prev => ({ ...prev, cuit: e.target.value }))}
              className="input"
              placeholder="XX-XXXXXXXX-X"
            />
          </div>
          <div>
            <label className="label" htmlFor="afip-razon-social">Razon Social</label>
            <input
              id="afip-razon-social"
              type="text"
              value={fiscal.razonSocial}
              onChange={(e) => setFiscal(prev => ({ ...prev, razonSocial: e.target.value }))}
              className="input"
              placeholder="Mi Restaurante S.R.L."
            />
          </div>
          <div>
            <label className="label" htmlFor="afip-condicion-iva">Condicion IVA</label>
            <select
              id="afip-condicion-iva"
              value={fiscal.condicionIva}
              onChange={(e) => setFiscal(prev => ({ ...prev, condicionIva: e.target.value }))}
              className="input"
            >
              <option value="">Seleccionar...</option>
              {CONDICION_IVA_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="afip-punto-venta">Punto de Venta</label>
            <input
              id="afip-punto-venta"
              type="number"
              value={fiscal.puntoVenta}
              onChange={(e) => setFiscal(prev => ({ ...prev, puntoVenta: e.target.value }))}
              className="input"
              placeholder="1"
              min="1"
            />
          </div>
          <div>
            <label className="label" htmlFor="afip-domicilio">Domicilio Fiscal</label>
            <input
              id="afip-domicilio"
              type="text"
              value={fiscal.domicilioFiscal}
              onChange={(e) => setFiscal(prev => ({ ...prev, domicilioFiscal: e.target.value }))}
              className="input"
              placeholder="Av. Principal 123, CABA"
            />
          </div>
          <div>
            <label className="label" htmlFor="afip-iibb">IIBB</label>
            <input
              id="afip-iibb"
              type="text"
              value={fiscal.iibb}
              onChange={(e) => setFiscal(prev => ({ ...prev, iibb: e.target.value }))}
              className="input"
              placeholder="Numero de IIBB"
            />
          </div>
          <div>
            <label className="label" htmlFor="afip-inicio-actividades">Inicio de Actividades</label>
            <input
              id="afip-inicio-actividades"
              type="date"
              value={fiscal.inicioActividades}
              onChange={(e) => setFiscal(prev => ({ ...prev, inicioActividades: e.target.value }))}
              className="input"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={guardarFiscal}
            disabled={savingFiscal}
            className={`btn btn-primary ${savingFiscal ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {savingFiscal ? 'Guardando...' : 'Guardar Datos Fiscales'}
          </button>
        </div>
      </div>

      {/* Certificados */}
      <div className="mb-6 pt-4 border-t border-border-subtle">
        <h4 className="font-semibold text-text-primary mb-3">Certificados AFIP</h4>

        {configurado && !csrPendiente && (
          <div className="flex items-center gap-2 mb-3 bg-success-50 p-3 rounded-xl">
            <CheckCircleIcon className="w-5 h-5 text-success-500" />
            <span className="text-sm text-success-700">Certificados cargados correctamente</span>
          </div>
        )}

        {csrPendiente && (
          <div className="flex items-center gap-2 mb-3 bg-warning-50 p-3 rounded-xl">
            <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />
            <span className="text-sm text-warning-700">
              CSR generado - Falta subir el certificado (.crt) de AFIP
            </span>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setCsrMode(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              csrMode
                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            Generar CSR (recomendado)
          </button>
          <button
            type="button"
            onClick={() => setCsrMode(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !csrMode
                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            Subir ambos archivos (avanzado)
          </button>
        </div>

        {csrMode ? (
          /* === CSR WIZARD FLOW === */
          <div className="space-y-4">
            {/* Paso 1: Generar CSR */}
            <div className="p-4 rounded-xl bg-surface-hover">
              <p className="font-medium text-text-primary mb-3">
                Paso 1: Generar solicitud de certificado (CSR)
              </p>
              <p className="text-sm text-text-secondary mb-3">
                Se generara una clave privada (almacenada de forma segura en el servidor) y un archivo CSR
                que deberas subir al portal de AFIP.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="label" htmlFor="csr-cuit">CUIT</label>
                  <input
                    id="csr-cuit"
                    type="text"
                    value={csrCuit}
                    onChange={(e) => setCsrCuit(e.target.value)}
                    className="input"
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="csr-alias">Alias del certificado</label>
                  <input
                    id="csr-alias"
                    type="text"
                    value={csrAlias}
                    onChange={(e) => setCsrAlias(e.target.value)}
                    className="input"
                    placeholder="comanda_wsfe"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="csr-razon">Razon Social (opcional)</label>
                  <input
                    id="csr-razon"
                    type="text"
                    value={csrRazonSocial}
                    onChange={(e) => setCsrRazonSocial(e.target.value)}
                    className="input"
                    placeholder="Se usa la del negocio"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={generarCsr}
                disabled={generatingCsr || !csrCuit || !csrAlias}
                className={`btn btn-primary flex items-center gap-2 ${
                  generatingCsr || !csrCuit || !csrAlias ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {generatingCsr ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="w-4 h-4" />
                )}
                {generatingCsr ? 'Generando...' : 'Generar CSR'}
              </button>
            </div>

            {/* Paso 1b: Descargar CSR */}
            {csrPem && (
              <div className="p-4 rounded-xl bg-success-50">
                <p className="font-medium text-success-700 mb-2">CSR generado exitosamente</p>
                <button
                  type="button"
                  onClick={descargarCsr}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Descargar CSR (.pem)
                </button>
                <p className="text-xs text-text-tertiary mt-2">
                  Subi este archivo en el portal de AFIP (Administracion de Certificados Digitales)
                  para obtener el certificado firmado (.crt).
                </p>
              </div>
            )}

            {/* Paso 2: Subir .crt */}
            {(csrPendiente || csrPem) && (
              <div className="p-4 rounded-xl bg-surface-hover">
                <p className="font-medium text-text-primary mb-3">
                  Paso 2: Subir certificado de AFIP (.crt)
                </p>
                <p className="text-sm text-text-secondary mb-3">
                  Una vez que AFIP te entregue el certificado firmado, subilo aca.
                  Se verificara automaticamente que corresponda a la clave privada generada.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="cursor-pointer flex-1">
                    <input
                      type="file"
                      accept=".crt,.pem,.cer"
                      onChange={(e) => setSoloCrtFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <span className="btn btn-secondary w-full flex items-center justify-center gap-2">
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      {soloCrtFile ? soloCrtFile.name : 'Seleccionar certificado (.crt)'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={subirSoloCrt}
                    disabled={uploadingSoloCrt || !soloCrtFile}
                    className={`btn btn-primary flex items-center gap-2 ${
                      uploadingSoloCrt || !soloCrtFile ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {uploadingSoloCrt ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUpTrayIcon className="w-4 h-4" />
                    )}
                    {uploadingSoloCrt ? 'Subiendo...' : 'Vincular Certificado'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* === MANUAL UPLOAD FLOW === */
          <div>
            <p className="text-sm text-text-secondary mb-3">
              Si ya tenes el certificado (.crt) y la clave privada (.key), subi ambos archivos.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Certificado (.crt / .pem)</label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".crt,.pem,.cer"
                    onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="btn btn-secondary w-full flex items-center justify-center gap-2">
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    {certFile ? certFile.name : 'Seleccionar certificado'}
                  </span>
                </label>
              </div>
              <div>
                <label className="label">Clave Privada (.key)</label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".key,.pem"
                    onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="btn btn-secondary w-full flex items-center justify-center gap-2">
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    {keyFile ? keyFile.name : 'Seleccionar clave privada'}
                  </span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={subirCertificado}
              disabled={uploadingCert || !certFile || !keyFile}
              className={`btn btn-primary flex items-center gap-2 ${
                uploadingCert || !certFile || !keyFile ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploadingCert ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUpTrayIcon className="w-4 h-4" />
              )}
              {uploadingCert ? 'Subiendo...' : 'Subir Certificados'}
            </button>
          </div>
        )}
      </div>

      {/* Modo y Test */}
      <div className="pt-4 border-t border-border-subtle">
        <h4 className="font-semibold text-text-primary mb-3">Modo de Operacion</h4>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={toggleModo}
            disabled={togglingModo}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              produccion
                ? 'bg-success-500 hover:bg-success-600 text-white'
                : 'bg-warning-100 hover:bg-warning-200 text-warning-800'
            } ${togglingModo ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {togglingModo ? 'Cambiando...' : produccion ? 'PRODUCCION' : 'HOMOLOGACION (Testing)'}
          </button>

          <button
            type="button"
            onClick={testConexion}
            disabled={testing}
            className={`btn btn-secondary flex items-center justify-center gap-2 ${testing ? 'opacity-50' : ''}`}
          >
            {testing ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheckIcon className="w-4 h-4" />
            )}
            {testing ? 'Probando...' : 'Probar Conexion'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 p-3 rounded-xl text-sm ${
            testResult.ok ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'
          }`}>
            <p className="font-medium">{testResult.ok ? 'Conexion exitosa' : 'Error de conexion'}</p>
            {testResult.message && <p className="mt-1">{testResult.message}</p>}
            {testResult.appServer && (
              <p className="mt-1 text-xs">
                App: {testResult.appServer} | DB: {testResult.dbServer} | Auth: {testResult.authServer}
              </p>
            )}
          </div>
        )}

        {!produccion && (
          <p className="text-xs text-text-tertiary mt-3">
            En modo Homologacion las facturas no tienen validez fiscal.
            Usa este modo para probar la integracion antes de activar Produccion.
          </p>
        )}
      </div>
    </div>
  )
}
