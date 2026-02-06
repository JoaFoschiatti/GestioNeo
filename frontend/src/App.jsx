import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layouts (static - needed immediately for routing)
import AdminLayout from './components/layouts/AdminLayout'
import PublicLayout from './components/layouts/PublicLayout'

// Componentes (static - needed immediately for routing)
import RedirectByRole from './components/RedirectByRole'
import ErrorBoundary from './components/ErrorBoundary'

// Public pages
const Login = lazy(() => import('./pages/Login'))
const MenuPublico = lazy(() => import('./pages/MenuPublico'))

// Admin pages
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Empleados = lazy(() => import('./pages/admin/Empleados'))
const Categorias = lazy(() => import('./pages/admin/Categorias'))
const Productos = lazy(() => import('./pages/admin/Productos'))
const Ingredientes = lazy(() => import('./pages/admin/Ingredientes'))
const Liquidaciones = lazy(() => import('./pages/admin/Liquidaciones'))
const Reportes = lazy(() => import('./pages/admin/Reportes'))
const Configuracion = lazy(() => import('./pages/admin/Configuracion'))
const CierreCaja = lazy(() => import('./pages/admin/CierreCaja'))
const Reservas = lazy(() => import('./pages/admin/Reservas'))
const Modificadores = lazy(() => import('./pages/admin/Modificadores'))
const TransaccionesMercadoPago = lazy(() => import('./pages/admin/TransaccionesMercadoPago'))
const Transferencias = lazy(() => import('./pages/admin/Transferencias'))
const Suscripcion = lazy(() => import('./pages/admin/Suscripcion'))
const MesasUnificado = lazy(() => import('./pages/admin/MesasUnificado'))

// Mozo pages
const NuevoPedido = lazy(() => import('./pages/mozo/NuevoPedido'))
const Pedidos = lazy(() => import('./pages/admin/Pedidos'))

// Cocina pages
const Cocina = lazy(() => import('./pages/cocina/Cocina'))

// Delivery pages
const DeliveryPedidos = lazy(() => import('./pages/delivery/DeliveryPedidos'))

const PageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
  </div>
)

function ProtectedRoute({ children, roles }) {
  const { usuario, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(usuario.rol)) {
    return <RedirectByRole />
  }

  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/menu" element={
            <PublicLayout>
              <MenuPublico />
            </PublicLayout>
          } />

          {/* Rutas protegidas */}
          <Route path="/" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<RedirectByRole />} />
            <Route path="dashboard" element={
              <ProtectedRoute roles={['ADMIN', 'COCINERO', 'CAJERO']}>
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="empleados" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Empleados />
              </ProtectedRoute>
            } />
            <Route path="mesas" element={
              <ProtectedRoute roles={['ADMIN', 'MOZO']}>
                <MesasUnificado />
              </ProtectedRoute>
            } />
            {/* Redirects antiguos a /mesas */}
            <Route path="plano-mesas" element={<Navigate to="/mesas" replace />} />
            <Route path="categorias" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Categorias />
              </ProtectedRoute>
            } />
            <Route path="productos" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Productos />
              </ProtectedRoute>
            } />
            <Route path="ingredientes" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Ingredientes />
              </ProtectedRoute>
            } />
            <Route path="liquidaciones" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Liquidaciones />
              </ProtectedRoute>
            } />
            <Route path="reportes" element={
              <ProtectedRoute roles={['ADMIN', 'CAJERO']}>
                <Reportes />
              </ProtectedRoute>
            } />
            <Route path="configuracion" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Configuracion />
              </ProtectedRoute>
            } />
            <Route path="cierre-caja" element={
              <ProtectedRoute roles={['ADMIN', 'CAJERO']}>
                <CierreCaja />
              </ProtectedRoute>
            } />
            <Route path="reservas" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Reservas />
              </ProtectedRoute>
            } />
            <Route path="modificadores" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Modificadores />
              </ProtectedRoute>
            } />
            <Route path="transacciones-mp" element={
              <ProtectedRoute roles={['ADMIN']}>
                <TransaccionesMercadoPago />
              </ProtectedRoute>
            } />
            <Route path="transferencias" element={
              <ProtectedRoute roles={['ADMIN', 'CAJERO']}>
                <Transferencias />
              </ProtectedRoute>
            } />
            <Route path="suscripcion" element={
              <ProtectedRoute roles={['ADMIN']}>
                <Suscripcion />
              </ProtectedRoute>
            } />
            <Route path="pedidos" element={<Pedidos />} />

            {/* Mozo */}
            <Route path="mozo/mesas" element={<Navigate to="/mesas" replace />} />
            <Route path="mozo/nuevo-pedido" element={
              <ProtectedRoute roles={['ADMIN', 'MOZO']}>
                <NuevoPedido />
              </ProtectedRoute>
            } />
            <Route path="mozo/nuevo-pedido/:mesaId" element={
              <ProtectedRoute roles={['ADMIN', 'MOZO']}>
                <NuevoPedido />
              </ProtectedRoute>
            } />

            {/* Cocina */}
            <Route path="cocina" element={
              <ProtectedRoute roles={['ADMIN', 'COCINERO']}>
                <Cocina />
              </ProtectedRoute>
            } />

            {/* Delivery */}
            <Route path="delivery/pedidos" element={
              <ProtectedRoute roles={['ADMIN', 'DELIVERY']}>
                <DeliveryPedidos />
              </ProtectedRoute>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<RedirectByRole />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
