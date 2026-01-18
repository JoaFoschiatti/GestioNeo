import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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
  UserCircleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['ADMIN', 'COCINERO', 'CAJERO'] },
  { name: 'Mesas', href: '/mozo/mesas', icon: TableCellsIcon, roles: ['ADMIN', 'MOZO'] },
  { name: 'Pedidos', href: '/pedidos', icon: ClipboardDocumentListIcon, roles: ['ADMIN', 'MOZO', 'CAJERO'] },
  { name: 'Cocina', href: '/cocina', icon: FireIcon, roles: ['ADMIN', 'COCINERO'] },
  { name: 'Mis Entregas', href: '/delivery/pedidos', icon: TruckIcon, roles: ['ADMIN', 'DELIVERY'] },
  { divider: true, roles: ['ADMIN'] },
  { name: 'Empleados', href: '/empleados', icon: UsersIcon, roles: ['ADMIN'] },
  { name: 'Config. Mesas', href: '/mesas', icon: TableCellsIcon, roles: ['ADMIN'] },
  { name: 'Categorías', href: '/categorias', icon: TagIcon, roles: ['ADMIN'] },
  { name: 'Productos', href: '/productos', icon: CubeIcon, roles: ['ADMIN'] },
  { name: 'Ingredientes', href: '/ingredientes', icon: BeakerIcon, roles: ['ADMIN'] },
  { divider: true, roles: ['ADMIN'] },
  { name: 'Liquidaciones', href: '/liquidaciones', icon: BanknotesIcon, roles: ['ADMIN'] },
  { name: 'Reportes', href: '/reportes', icon: ChartBarIcon, roles: ['ADMIN', 'CAJERO'] },
  { name: 'Configuración', href: '/configuracion', icon: Cog6ToothIcon, roles: ['ADMIN'] },
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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar móvil */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h1 className="text-xl font-bold text-primary-600">GestioNeo</h1>
            <button onClick={() => setSidebarOpen(false)}>
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {filteredNav.map((item, i) =>
              item.divider ? (
                <hr key={i} className="my-4 border-gray-200" />
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

      {/* Sidebar desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center px-6 py-5 border-b">
            <h1 className="text-2xl font-bold text-primary-600">GestioNeo</h1>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item, i) =>
              item.divider ? (
                <hr key={i} className="my-4 border-gray-200" />
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
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 px-4 py-3">
              <UserCircleIcon className="w-10 h-10 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {usuario?.nombre}
                </p>
                <p className="text-xs text-gray-500">{usuario?.rol}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="lg:pl-72">
        {/* Header móvil */}
        <div className="sticky top-0 z-40 flex items-center gap-4 px-4 py-4 bg-white border-b lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Bars3Icon className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-primary-600">GestioNeo</h1>
        </div>

        {/* Contenido */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
