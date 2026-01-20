import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layouts
import AdminLayout from './components/layouts/AdminLayout'
import PublicLayout from './components/layouts/PublicLayout'

// Componentes
import RedirectByRole from './components/RedirectByRole'

// Páginas públicas
import Login from './pages/Login'
import MenuPublico from './pages/MenuPublico'
import Registro from './pages/Registro'
import VerificarEmail from './pages/VerificarEmail'

// Páginas admin
import Dashboard from './pages/admin/Dashboard'
import Empleados from './pages/admin/Empleados'
import Mesas from './pages/admin/Mesas'
import Categorias from './pages/admin/Categorias'
import Productos from './pages/admin/Productos'
import Ingredientes from './pages/admin/Ingredientes'
import Liquidaciones from './pages/admin/Liquidaciones'
import Reportes from './pages/admin/Reportes'
import Configuracion from './pages/admin/Configuracion'
import CierreCaja from './pages/admin/CierreCaja'
import Reservas from './pages/admin/Reservas'
import Modificadores from './pages/admin/Modificadores'
import TransaccionesMercadoPago from './pages/admin/TransaccionesMercadoPago'

// Páginas mozo
import MozoMesas from './pages/mozo/MozoMesas'
import NuevoPedido from './pages/mozo/NuevoPedido'
import Pedidos from './pages/admin/Pedidos'

// Páginas cocinero
import Cocina from './pages/cocina/Cocina'

// Páginas delivery
import DeliveryPedidos from './pages/delivery/DeliveryPedidos'

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
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/login/:slug" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/verificar-email/:token" element={<VerificarEmail />} />
      <Route path="/menu/:slug" element={
        <PublicLayout>
          <MenuPublico />
        </PublicLayout>
      } />
      {/* Backwards compatibility - redirect to default tenant */}
      <Route path="/menu" element={<Navigate to="/menu/default" replace />} />

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
        <Route path="mesas" element={<Mesas />} />
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
        <Route path="pedidos" element={<Pedidos />} />

        {/* Mozo */}
        <Route path="mozo/mesas" element={
          <ProtectedRoute roles={['ADMIN', 'MOZO']}>
            <MozoMesas />
          </ProtectedRoute>
        } />
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
  )
}
