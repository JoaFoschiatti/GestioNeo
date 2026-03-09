import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import SubscriptionBanner from '../SubscriptionBanner'
import { Avatar } from '../ui'
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
  ListBulletIcon,
  FireIcon,
  TruckIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  AdjustmentsHorizontalIcon,
  CreditCardIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline'

const navSections = [
  {
    title: 'Operaciones',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['ADMIN', 'COCINERO', 'CAJERO'] },
      { name: 'Tareas', href: '/tareas', icon: ListBulletIcon, roles: ['ADMIN', 'CAJERO'] },
      { name: 'Mesas', href: '/mozo/mesas', icon: TableCellsIcon, roles: ['ADMIN', 'MOZO'] },
      { name: 'Mesas', href: '/mesas', icon: TableCellsIcon, roles: ['CAJERO'] },
      { name: 'Reservas', href: '/reservas', icon: CalendarDaysIcon, roles: ['ADMIN'] },
      { name: 'Pedidos', href: '/pedidos', icon: ClipboardDocumentListIcon, roles: ['ADMIN', 'MOZO', 'CAJERO'] },
      { name: 'Cocina', href: '/cocina', icon: FireIcon, roles: ['ADMIN', 'COCINERO', 'CAJERO'] },
      { name: 'Mis Entregas', href: '/delivery/pedidos', icon: TruckIcon, roles: ['ADMIN', 'DELIVERY'] }
    ]
  },
  {
    title: 'Administracion',
    items: [
      { name: 'Usuarios', href: '/usuarios', icon: UsersIcon, roles: ['ADMIN'] },
      { name: 'Config. Mesas', href: '/mesas', icon: TableCellsIcon, roles: ['ADMIN'] },
      { name: 'Categorias', href: '/categorias', icon: TagIcon, roles: ['ADMIN'] },
      { name: 'Productos', href: '/productos', icon: CubeIcon, roles: ['ADMIN'] },
      { name: 'Modificadores', href: '/modificadores', icon: AdjustmentsHorizontalIcon, roles: ['ADMIN'] },
      { name: 'Ingredientes', href: '/ingredientes', icon: BeakerIcon, roles: ['ADMIN'] }
    ]
  },
  {
    title: 'Finanzas',
    items: [
      { name: 'Liquidaciones', href: '/liquidaciones', icon: BanknotesIcon, roles: ['ADMIN'] },
      { name: 'Transacciones MP', href: '/transacciones-mp', icon: CreditCardIcon, roles: ['ADMIN'] },
      { name: 'Reportes', href: '/reportes', icon: ChartBarIcon, roles: ['ADMIN'] },
      { name: 'Cierre de Caja', href: '/cierre-caja', icon: BanknotesIcon, roles: ['ADMIN', 'CAJERO'] }
    ]
  },
  {
    title: 'Configuracion',
    items: [
      { name: 'Configuracion', href: '/configuracion', icon: Cog6ToothIcon, roles: ['ADMIN'] }
    ]
  }
]

function SidebarNav({ userRole, onLinkClick }) {
  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll">
      {navSections.map((section) => {
        const visibleItems = section.items.filter(item => item.roles.includes(userRole))
        if (visibleItems.length === 0) return null

        return (
          <div key={section.title}>
            <div className="sidebar-section-title">{section.title}</div>
            <div className="space-y-0.5">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                  onClick={onLinkClick}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function usePageTitle() {
  const location = useLocation()

  for (const section of navSections) {
    for (const item of section.items) {
      if (location.pathname === item.href || location.pathname.startsWith(item.href + '/')) {
        return item.name
      }
    }
  }

  return 'Dashboard'
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { usuario, logout } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const pageTitle = usePageTitle()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-shell min-h-screen bg-canvas">
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 admin-sidebar-panel flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
              <div>
                <span className="text-lg font-bold text-white tracking-tight">Comanda</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg text-brand-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <SidebarNav userRole={usuario?.rol} onLinkClick={() => setSidebarOpen(false)} />

            <div className="p-3 border-t border-brand-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-brand-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="admin-sidebar flex flex-col flex-grow overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <img src="/comanda-logo.png" alt="Comanda" className="w-10 h-10 rounded-2xl shadow-lg shadow-primary-500/20 object-cover" />
            <div>
              <span className="text-lg font-bold text-white tracking-tight">Comanda</span>
            </div>
          </div>

          <SidebarNav userRole={usuario?.rol} />

          <div className="p-3 border-t border-brand-800">
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <Avatar name={usuario?.nombre} size="sm" className="bg-brand-700 text-brand-200" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {usuario?.nombre}
                </p>
                <p className="text-xs text-brand-400">{usuario?.rol}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-brand-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Cerrar sesion
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-64">
        <SubscriptionBanner />

        <header className="admin-topbar sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors lg:hidden"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>

              <div>
                <h2 className="text-base font-bold">{pageTitle}</h2>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
                aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
              >
                {dark ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>
              <span className="text-sm">{usuario?.nombre}</span>
              <Avatar name={usuario?.nombre} size="sm" />
            </div>
          </div>
        </header>

        <main className="admin-main p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
