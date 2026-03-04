/**
 * Contexto de autenticación global para Comanda.
 *
 * Provee estado de autenticación a toda la aplicación:
 * - Usuario actual (datos del JWT decodificado)
 * - Negocio (datos de la empresa)
 * - Funciones de login/logout
 * - Roles y permisos derivados (esAdmin, esMozo, etc.)
 *
 * El token JWT se almacena en httpOnly cookies (seguro contra XSS) y se envía
 * automáticamente con todas las requests mediante withCredentials: true.
 *
 * @module AuthContext
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { canAccessRouteByKey } from '../config/permissions'

const AuthContext = createContext(null)

/**
 * Provider de autenticación que envuelve la aplicación.
 *
 * Al montar, verifica si hay datos de sesión guardados y restaura el estado.
 * El token JWT está en httpOnly cookie y se verifica automáticamente por el backend.
 * Provee las funciones login() y logout() a los componentes hijos.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componentes hijos
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [negocio, setNegocio] = useState(null)
  const [suscripcion, setSuscripcion] = useState(null)
  const [modoSoloLectura, setModoSoloLectura] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore user/negocio/suscripcion from localStorage (not token - that's in httpOnly cookie)
    const usuarioGuardado = localStorage.getItem('usuario')
    const negocioGuardado = localStorage.getItem('negocio')
    const suscripcionGuardada = localStorage.getItem('suscripcion')
    const modoSoloLecturaGuardado = localStorage.getItem('modoSoloLectura')

    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado))
    }
    if (negocioGuardado) {
      setNegocio(JSON.parse(negocioGuardado))
    }
    if (suscripcionGuardada) {
      setSuscripcion(JSON.parse(suscripcionGuardada))
    }
    if (modoSoloLecturaGuardado) {
      setModoSoloLectura(JSON.parse(modoSoloLecturaGuardado))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password, options = {}) => {
    const response = await api.post('/auth/login', { email, password }, options)
    const { usuario, negocio: negocioData, suscripcion: suscripcionData, modoSoloLectura: soloLectura } = response.data

    // Token is automatically set as httpOnly cookie by the backend
    // Store only user/negocio/suscripcion info in localStorage for quick access
    localStorage.setItem('usuario', JSON.stringify(usuario))
    if (negocioData) {
      localStorage.setItem('negocio', JSON.stringify(negocioData))
      setNegocio(negocioData)
    }
    if (suscripcionData) {
      localStorage.setItem('suscripcion', JSON.stringify(suscripcionData))
      setSuscripcion(suscripcionData)
    }
    localStorage.setItem('modoSoloLectura', JSON.stringify(soloLectura ?? false))
    setModoSoloLectura(soloLectura ?? false)

    setUsuario(usuario)
    return { usuario, suscripcion: suscripcionData, modoSoloLectura: soloLectura }
  }, [])

  const logout = useCallback(async () => {
    try {
      // Call backend to clear httpOnly cookie
      await api.post('/auth/logout')
    } catch (error) {
      // Continue with logout even if backend call fails
      console.error('Error during logout:', error)
    }

    // Clear localStorage and state
    localStorage.removeItem('usuario')
    localStorage.removeItem('negocio')
    localStorage.removeItem('suscripcion')
    localStorage.removeItem('modoSoloLectura')
    setUsuario(null)
    setNegocio(null)
    setSuscripcion(null)
    setModoSoloLectura(false)
  }, [])

  // Refresh subscription status (call after subscribing or to check current status)
  const refrescarSuscripcion = useCallback(async () => {
    try {
      const response = await api.get('/auth/perfil')
      const { suscripcion: suscripcionData, modoSoloLectura: soloLectura } = response.data

      if (suscripcionData) {
        localStorage.setItem('suscripcion', JSON.stringify(suscripcionData))
        setSuscripcion(suscripcionData)
      }
      localStorage.setItem('modoSoloLectura', JSON.stringify(soloLectura ?? false))
      setModoSoloLectura(soloLectura ?? false)

      return { suscripcion: suscripcionData, modoSoloLectura: soloLectura }
    } catch (error) {
      console.error('Error refreshing subscription:', error)
      throw error
    }
  }, [])

  const value = useMemo(() => {
    const esAdmin = usuario?.rol === 'ADMIN'
    const esMozo = canAccessRouteByKey(usuario?.rol, 'mesas')
    const esCocinero = canAccessRouteByKey(usuario?.rol, 'cocina')
    const esCajero = ['ADMIN', 'CAJERO'].includes(usuario?.rol)
    const esDelivery = canAccessRouteByKey(usuario?.rol, 'deliveryPedidos')

    // Determine subscription status
    const suscripcionActiva = suscripcion?.estado === 'ACTIVA'
    const suscripcionPendiente = suscripcion?.estado === 'PENDIENTE' || !suscripcion
    const suscripcionMorosa = suscripcion?.estado === 'MOROSA'

    return {
      usuario,
      negocio,
      suscripcion,
      modoSoloLectura,
      suscripcionActiva,
      suscripcionPendiente,
      suscripcionMorosa,
      login,
      logout,
      refrescarSuscripcion,
      loading,
      esAdmin,
      esMozo,
      esCocinero,
      esCajero,
      esDelivery
    }
  }, [usuario, negocio, suscripcion, modoSoloLectura, login, logout, refrescarSuscripcion, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook para acceder al contexto de autenticación.
 *
 * Debe usarse dentro de un componente envuelto por AuthProvider.
 *
 * @returns {Object} Contexto de autenticación
 * @returns {Object|null} returns.usuario - Usuario autenticado o null
 * @returns {Object|null} returns.negocio - Datos del negocio o null
 * @returns {Function} returns.login - Función de login (email, password)
 * @returns {Function} returns.logout - Función de logout
 * @returns {boolean} returns.loading - True mientras verifica el token inicial
 * @returns {boolean} returns.esAdmin - True si rol es ADMIN
 * @returns {boolean} returns.esMozo - True si rol es MOZO o ADMIN
 * @returns {boolean} returns.esCocinero - True si rol es COCINERO o ADMIN
 * @returns {boolean} returns.esCajero - True si rol es CAJERO o ADMIN
 * @returns {boolean} returns.esDelivery - True si rol es DELIVERY o ADMIN
 *
 * @throws {Error} Si se usa fuera de AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
