import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import useEventSource from '../../hooks/useEventSource'
import useAsync from '../../hooks/useAsync'
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const cargarDashboard = useCallback(async () => {
    const response = await api.get('/reportes/dashboard', { skipToast: true })
    setData(response.data)
    setErrorMessage(null)
    return response.data
  }, [])

  const handleLoadError = useCallback((error) => {
    console.error('Error al cargar dashboard:', error)
    setErrorMessage(error.response?.data?.error?.message || 'Error al cargar dashboard')
  }, [])

  const cargarDashboardRequest = useCallback(async (_ctx) => (
    cargarDashboard()
  ), [cargarDashboard])

  const { loading, execute: cargarDashboardAsync } = useAsync(
    cargarDashboardRequest,
    { immediate: false, onError: handleLoadError }
  )

  const handleProductoAgotado = useCallback((event) => {
    try {
      const data = JSON.parse(event.data)
      toast.error(`⚠️ Producto agotado: ${data.nombre}`, { duration: 5000 })
      cargarDashboardAsync().catch(() => {}) // Recargar para actualizar alertas
    } catch (e) {
      console.error('Error parsing producto.agotado event:', e)
    }
  }, [cargarDashboardAsync])

  const handleProductoDisponible = useCallback((event) => {
    try {
      const data = JSON.parse(event.data)
      toast.success(`✓ Producto disponible: ${data.nombre}`, { duration: 4000 })
      cargarDashboardAsync().catch(() => {})
    } catch (e) {
      console.error('Error parsing producto.disponible event:', e)
    }
  }, [cargarDashboardAsync])

  useEffect(() => {
    cargarDashboardAsync()
      .catch(() => {})
  }, [cargarDashboardAsync])

  useEventSource({
    events: {
      'producto.agotado': handleProductoAgotado,
      'producto.disponible': handleProductoDisponible
    }
  })

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const stats = [
    {
      name: 'Ventas de Hoy',
      value: `$${data?.ventasHoy?.toLocaleString('es-AR') || 0}`,
      icon: CurrencyDollarIcon,
      color: 'bg-green-500'
    },
    {
      name: 'Pedidos Hoy',
      value: data?.pedidosHoy || 0,
      icon: ShoppingCartIcon,
      color: 'bg-blue-500'
    },
    {
      name: 'Pedidos Pendientes',
      value: data?.pedidosPendientes || 0,
      icon: ClockIcon,
      color: 'bg-yellow-500',
      link: '/pedidos'
    },
    {
      name: 'Mesas Ocupadas',
      value: `${data?.mesasOcupadas || 0} / ${data?.mesasTotal || 0}`,
      icon: TableCellsIcon,
      color: 'bg-purple-500',
      link: '/mozo/mesas'
    },
    {
      name: 'Alertas de Stock',
      value: data?.alertasStock || 0,
      icon: ExclamationTriangleIcon,
      color: data?.alertasStock > 0 ? 'bg-red-500' : 'bg-gray-400',
      link: '/ingredientes'
    },
    {
      name: 'Empleados Trabajando',
      value: data?.empleadosTrabajando || 0,
      icon: UsersIcon,
      color: 'bg-indigo-500'
    }
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {errorMessage && (
        <div className="card mb-6 border border-red-200 bg-red-50 text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              cargarDashboardAsync()
                .catch(() => {})
            }}
            className="btn btn-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Card = stat.link ? Link : 'div'
          return (
            <Card
              key={stat.name}
              to={stat.link}
              className={`card flex items-center gap-4 ${stat.link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
            >
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Accesos rápidos */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/mozo/nuevo-pedido"
            className="card text-center hover:shadow-md transition-shadow"
          >
            <ShoppingCartIcon className="w-8 h-8 mx-auto text-primary-500 mb-2" />
            <p className="font-medium text-gray-900">Nuevo Pedido</p>
          </Link>
          <Link
            to="/mozo/mesas"
            className="card text-center hover:shadow-md transition-shadow"
          >
            <TableCellsIcon className="w-8 h-8 mx-auto text-primary-500 mb-2" />
            <p className="font-medium text-gray-900">Ver Mesas</p>
          </Link>
          <Link
            to="/cocina"
            className="card text-center hover:shadow-md transition-shadow"
          >
            <ClockIcon className="w-8 h-8 mx-auto text-primary-500 mb-2" />
            <p className="font-medium text-gray-900">Cocina</p>
          </Link>
          <Link
            to="/reportes"
            className="card text-center hover:shadow-md transition-shadow"
          >
            <CurrencyDollarIcon className="w-8 h-8 mx-auto text-primary-500 mb-2" />
            <p className="font-medium text-gray-900">Reportes</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
