/**
 * Contexto de autenticación global para GestioNeo.
 *
 * Provee estado de autenticación a toda la aplicación:
 * - Usuario actual (datos del JWT decodificado)
 * - Tenant (restaurante) al que pertenece
 * - Funciones de login/logout
 * - Roles y permisos derivados (esAdmin, esMozo, etc.)
 *
 * El token JWT se almacena en httpOnly cookies (seguro contra XSS) y se envía
 * automáticamente con todas las requests mediante withCredentials: true.
 *
 * @module AuthContext
 *
 * @example
 * // En App.jsx - Envolver la aplicación
 * import { AuthProvider } from './context/AuthContext';
 *
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <Router>
 *         <Routes>...</Routes>
 *       </Router>
 *     </AuthProvider>
 *   );
 * }
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'

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
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore user/tenant from localStorage (not token - that's in httpOnly cookie)
    const usuarioGuardado = localStorage.getItem('usuario')
    const tenantGuardado = localStorage.getItem('tenant')

    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado))
    }
    if (tenantGuardado) {
      setTenant(JSON.parse(tenantGuardado))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password, slug = undefined, options = {}) => {
    const response = await api.post('/auth/login', { email, password, slug }, options)
    const { usuario, tenant } = response.data

    // Token is automatically set as httpOnly cookie by the backend
    // Store only user/tenant info in localStorage for quick access
    localStorage.setItem('usuario', JSON.stringify(usuario))
    if (tenant) {
      localStorage.setItem('tenant', JSON.stringify(tenant))
      setTenant(tenant)
    }

    setUsuario(usuario)
    return usuario
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
    localStorage.removeItem('tenant')
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

/**
 * Hook para acceder al contexto de autenticación.
 *
 * Debe usarse dentro de un componente envuelto por AuthProvider.
 *
 * @returns {Object} Contexto de autenticación
 * @returns {Object|null} returns.usuario - Usuario autenticado o null
 * @returns {number} returns.usuario.id - ID del usuario
 * @returns {string} returns.usuario.email - Email
 * @returns {string} returns.usuario.nombre - Nombre completo
 * @returns {string} returns.usuario.rol - Rol: 'ADMIN', 'MOZO', 'COCINERO', etc.
 * @returns {number} returns.usuario.tenantId - ID del tenant
 * @returns {Object|null} returns.tenant - Restaurante actual o null
 * @returns {number} returns.tenant.id - ID del tenant
 * @returns {string} returns.tenant.nombre - Nombre del restaurante
 * @returns {string} returns.tenant.slug - Slug único (ej: 'mi-restaurante')
 * @returns {Function} returns.login - Función de login (email, password, slug?)
 * @returns {Function} returns.logout - Función de logout
 * @returns {boolean} returns.loading - True mientras verifica el token inicial
 * @returns {boolean} returns.esAdmin - True si rol es ADMIN
 * @returns {boolean} returns.esMozo - True si rol es MOZO o ADMIN
 * @returns {boolean} returns.esCocinero - True si rol es COCINERO o ADMIN
 * @returns {boolean} returns.esCajero - True si rol es CAJERO o ADMIN
 * @returns {boolean} returns.esDelivery - True si rol es DELIVERY o ADMIN
 * @returns {boolean} returns.esSuperAdmin - True si rol es SUPER_ADMIN
 *
 * @throws {Error} Si se usa fuera de AuthProvider
 *
 * @example
 * import { useAuth } from '../context/AuthContext';
 *
 * function NavBar() {
 *   const { usuario, logout, esAdmin } = useAuth();
 *
 *   return (
 *     <nav>
 *       <span>Hola, {usuario?.nombre}</span>
 *       {esAdmin && <Link to="/reportes">Reportes</Link>}
 *       <button onClick={logout}>Cerrar sesión</button>
 *     </nav>
 *   );
 * }
 *
 * @example
 * // Proteger contenido por rol
 * function Dashboard() {
 *   const { esAdmin, loading } = useAuth();
 *
 *   if (loading) return <Spinner />;
 *   if (!esAdmin) return <Navigate to="/mesas" />;
 *
 *   return <AdminDashboard />;
 * }
 *
 * @example
 * // Login
 * function LoginForm() {
 *   const { login } = useAuth();
 *   const navigate = useNavigate();
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     try {
 *       await login(email, password, slug);
 *       navigate('/');
 *     } catch (error) {
 *       setError('Credenciales inválidas');
 *     }
 *   };
 * }
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
