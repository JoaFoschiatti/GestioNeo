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
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  AdjustmentsHorizontalIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { ROUTE_ACCESS } from '../../config/permissions'

function MotorcycleIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="5" cy="17.5" r="2.75" />
      <circle cx="19" cy="17.5" r="2.75" />
      <path d="M7.5 16L10 11h4l2.5 3.5" />
      <path d="M16.5 14.5L19 17.5" />
      <path d="M14 11l3.5-2" />
      <rect x="3" y="7.5" width="5" height="3.5" rx=".5" />
      <path d="M5.5 11v3" />
      <circle cx="12.5" cy="5.5" r="1.5" />
      <path d="M12.5 7l-.5 3.5" />
      <path d="M12 8.5l2.5 2" />
      <path d="M12 10.5l2 1" />
      <path d="M14 11.5v3" />
    </svg>
  )
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ROUTE_ACCESS.dashboard },
  { name: 'Mesas', href: '/mesas', icon: TableCellsIcon, roles: ROUTE_ACCESS.mesas },
  { name: 'Reservas', href: '/reservas', icon: CalendarDaysIcon, roles: ROUTE_ACCESS.reservas },
  { name: 'Pedidos', href: '/pedidos', icon: ClipboardDocumentListIcon, roles: ROUTE_ACCESS.pedidos },
  { name: 'Cocina', href: '/cocina', icon: FireIcon, roles: ROUTE_ACCESS.cocina },
  { name: 'Mis Entregas', href: '/delivery/pedidos', icon: MotorcycleIcon, roles: ROUTE_ACCESS.deliveryPedidos },
  { divider: true, roles: ROUTE_ACCESS.empleados },
  { name: 'Empleados', href: '/empleados', icon: UsersIcon, roles: ROUTE_ACCESS.empleados },
  { name: 'Categorías', href: '/categorias', icon: TagIcon, roles: ROUTE_ACCESS.categorias },
  { name: 'Productos', href: '/productos', icon: CubeIcon, roles: ROUTE_ACCESS.productos },
  { name: 'Modificadores', href: '/modificadores', icon: AdjustmentsHorizontalIcon, roles: ROUTE_ACCESS.modificadores },
  { name: 'Ingredientes', href: '/ingredientes', icon: BeakerIcon, roles: ROUTE_ACCESS.ingredientes },
  { divider: true, roles: ROUTE_ACCESS.empleados },
  { name: 'Liquidaciones', href: '/liquidaciones', icon: BanknotesIcon, roles: ROUTE_ACCESS.liquidaciones },
  { name: 'Transacciones MP', href: '/transacciones-mp', icon: CreditCardIcon, roles: ROUTE_ACCESS.transaccionesMp },
  { name: 'Transferencias', href: '/transferencias', icon: BuildingLibraryIcon, roles: ROUTE_ACCESS.transferencias },
  { name: 'Reportes', href: '/reportes', icon: ChartBarIcon, roles: ROUTE_ACCESS.reportes },
  { name: 'Cierre de Caja', href: '/cierre-caja', icon: BanknotesIcon, roles: ROUTE_ACCESS.cierreCaja },
  { name: 'Configuración', href: '/configuracion', icon: Cog6ToothIcon, roles: ROUTE_ACCESS.configuracion },
  { name: 'Suscripción', href: '/suscripcion', icon: SparklesIcon, roles: ROUTE_ACCESS.suscripcion },
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
        <main className="p-4 lg:p-8 max-w-screen-2xl mx-auto page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
