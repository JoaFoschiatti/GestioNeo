import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioGuardado = localStorage.getItem('usuario')

    if (token && usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado))
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    const { token, usuario } = response.data

    localStorage.setItem('token', token)
    localStorage.setItem('usuario', JSON.stringify(usuario))
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`

    setUsuario(usuario)
    return usuario
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    delete api.defaults.headers.common['Authorization']
    setUsuario(null)
  }

  const esAdmin = usuario?.rol === 'ADMIN'
  const esMozo = usuario?.rol === 'MOZO' || esAdmin
  const esCocinero = usuario?.rol === 'COCINERO' || esAdmin
  const esCajero = usuario?.rol === 'CAJERO' || esAdmin
  const esDelivery = usuario?.rol === 'DELIVERY' || esAdmin

  return (
    <AuthContext.Provider value={{
      usuario,
      login,
      logout,
      loading,
      esAdmin,
      esMozo,
      esCocinero,
      esCajero,
      esDelivery
    }}>
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
