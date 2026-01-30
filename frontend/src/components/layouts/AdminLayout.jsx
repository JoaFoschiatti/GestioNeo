import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import SubscriptionBanner from '../SubscriptionBanner'
import {
  HomeIcon,
  UsersIcon,
  TableCellsIcon,
  TagIcon,
  CubeIcon,
  BeakerIcon,
  BanknotesIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  FireIcon,
  TruckIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  AdjustmentsHorizontalIcon,
  CreditCardIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['ADMIN', 'COCINERO', 'CAJERO'] },
  { name: 'Mesas', href: '/mesas', icon: TableCellsIcon, roles: ['ADMIN', 'MOZO'] },
  { name: 'Reservas', href: '/reservas', icon: CalendarDaysIcon, roles: ['ADMIN'] },
  { name: 'Pedidos', href: '/pedidos', icon: ClipboardDocumentListIcon, roles: ['ADMIN', 'MOZO', 'CAJERO'] },
  { name: 'Cocina', href: '/cocina', icon: FireIcon, roles: ['ADMIN', 'COCINERO'] },
  { name: 'Mis Entregas', href: '/delivery/pedidos', icon: TruckIcon, roles: ['ADMIN', 'DELIVERY'] },
  { divider: true, roles: ['ADMIN'] },
  { name: 'Empleados', href: '/empleados', icon: UsersIcon, roles: ['ADMIN'] },
  { name: 'Categorías', href: '/categorias', icon: TagIcon, roles: ['ADMIN'] },
  { name: 'Productos', href: '/productos', icon: CubeIcon, roles: ['ADMIN'] },
  { name: 'Modificadores', href: '/modificadores', icon: AdjustmentsHorizontalIcon, roles: ['ADMIN'] },
  { name: 'Ingredientes', href: '/ingredientes', icon: BeakerIcon, roles: ['ADMIN'] },
  { divider: true, roles: ['ADMIN'] },
  { name: 'Liquidaciones', href: '/liquidaciones', icon: BanknotesIcon, roles: ['ADMIN'] },
  { name: 'Transacciones MP', href: '/transacciones-mp', icon: CreditCardIcon, roles: ['ADMIN'] },
  { name: 'Reportes', href: '/reportes', icon: ChartBarIcon, roles: ['ADMIN', 'CAJERO'] },
  { name: 'Cierre de Caja', href: '/cierre-caja', icon: BanknotesIcon, roles: ['ADMIN', 'CAJERO'] },
  { name: 'Configuración', href: '/configuracion', icon: Cog6ToothIcon, roles: ['ADMIN'] },
  { name: 'Suscripción', href: '/suscripcion', icon: SparklesIcon, roles: ['ADMIN'] },
]

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredNav = navigation.filter(item =>
    item.roles?.includes(usuario?.rol)
  )

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile sidebar overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div
          className="fixed inset-0 bg-text-primary/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 w-72 bg-surface shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <h1 className="text-xl font-semibold text-text-primary">Comanda</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item, i) =>
              item.divider ? (
                <div key={i} className="divider" />
              ) : (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              )
            )}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow overflow-hidden bg-surface border-r border-border-subtle">
          {/* Logo */}
          <div className="flex items-center px-6 py-5 border-b border-border-subtle">
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">Comanda</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item, i) =>
              item.divider ? (
                <div key={i} className="divider" />
              ) : (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              )
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border-subtle">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="avatar avatar-md">
                {usuario?.nombre?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {usuario?.nombre}
                </p>
                <p className="text-xs text-text-tertiary">{usuario?.rol}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Subscription Banner */}
        <SubscriptionBanner />

        {/* Mobile header */}
        <div className="sticky top-0 z-40 flex items-center gap-4 px-4 py-4 bg-surface border-b border-border-subtle lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Bars3Icon className="w-6 h-6 text-text-secondary" />
          </button>
          <h1 className="text-lg font-semibold text-text-primary">Comanda</h1>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
