import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioGuardado = localStorage.getItem('usuario')
    const tenantGuardado = localStorage.getItem('tenant')

    if (token && usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado))
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    if (tenantGuardado) {
      setTenant(JSON.parse(tenantGuardado))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password, slug = undefined, options = {}) => {
    const response = await api.post('/auth/login', { email, password, slug }, options)
    const { token, usuario, tenant } = response.data

    localStorage.setItem('token', token)
    localStorage.setItem('usuario', JSON.stringify(usuario))
    if (tenant) {
      localStorage.setItem('tenant', JSON.stringify(tenant))
      setTenant(tenant)
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`

    setUsuario(usuario)
    return usuario
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    localStorage.removeItem('tenant')
    delete api.defaults.headers.common['Authorization']
    setUsuario(null)
    setTenant(null)
  }, [])

  const value = useMemo(() => {
    const esAdmin = usuario?.rol === 'ADMIN'
    const esMozo = usuario?.rol === 'MOZO' || esAdmin
    const esCocinero = usuario?.rol === 'COCINERO' || esAdmin
    const esCajero = usuario?.rol === 'CAJERO' || esAdmin
    const esDelivery = usuario?.rol === 'DELIVERY' || esAdmin
    const esSuperAdmin = usuario?.rol === 'SUPER_ADMIN'

    return {
      usuario,
      tenant,
      login,
      logout,
      loading,
      esAdmin,
      esMozo,
      esCocinero,
      esCajero,
      esDelivery,
      esSuperAdmin
    }
  }, [usuario, tenant, login, logout, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
