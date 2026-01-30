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
      toast.error(`Producto agotado: ${data.nombre}`, { duration: 5000 })
      cargarDashboardAsync().catch(() => {})
    } catch (e) {
      console.error('Error parsing producto.agotado event:', e)
    }
  }, [cargarDashboardAsync])

  const handleProductoDisponible = useCallback((event) => {
    try {
      const data = JSON.parse(event.data)
      toast.success(`Producto disponible: ${data.nombre}`, { duration: 4000 })
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
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  const stats = [
    {
      name: 'Ventas de Hoy',
      value: `$${data?.ventasHoy?.toLocaleString('es-AR') || 0}`,
      icon: CurrencyDollarIcon,
      link: null
    },
    {
      name: 'Pedidos Hoy',
      value: data?.pedidosHoy || 0,
      icon: ShoppingCartIcon,
      link: null
    },
    {
      name: 'Pedidos Pendientes',
      value: data?.pedidosPendientes || 0,
      icon: ClockIcon,
      highlight: data?.pedidosPendientes > 0,
      link: '/pedidos'
    },
    {
      name: 'Mesas Ocupadas',
      value: `${data?.mesasOcupadas || 0} / ${data?.mesasTotal || 0}`,
      icon: TableCellsIcon,
      link: '/mozo/mesas'
    },
    {
      name: 'Alertas de Stock',
      value: data?.alertasStock || 0,
      icon: ExclamationTriangleIcon,
      highlight: data?.alertasStock > 0,
      isWarning: data?.alertasStock > 0,
      link: '/ingredientes'
    },
    {
      name: 'Empleados Trabajando',
      value: data?.empleadosTrabajando || 0,
      icon: UsersIcon,
      link: null
    }
  ]

  return (
    <div>
      <h1 className="text-heading-1 mb-6">Dashboard</h1>

      {errorMessage && (
        <div className="alert alert-error mb-6 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              cargarDashboardAsync()
                .catch(() => {})
            }}
            className="btn btn-secondary btn-sm"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Card = stat.link ? Link : 'div'
          return (
            <Card
              key={stat.name}
              to={stat.link}
              className={`stat-card card-hover flex items-center gap-4 ${stat.link ? 'cursor-pointer' : ''}`}
            >
              <div className={`p-3 rounded-xl ${
                stat.isWarning
                  ? 'bg-warning-100'
                  : stat.highlight
                    ? 'bg-primary-100'
                    : 'bg-primary-50'
              }`}>
                <stat.icon className={`w-6 h-6 ${
                  stat.isWarning
                    ? 'text-warning-600'
                    : 'text-primary-500'
                }`} />
              </div>
              <div>
                <p className="stat-label">{stat.name}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Quick access */}
      <div className="mt-10">
        <h2 className="text-heading-3 mb-4">Accesos Rapidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/mozo/nuevo-pedido"
            className="card card-hover text-center py-8"
          >
            <ShoppingCartIcon className="w-8 h-8 mx-auto text-primary-500 mb-3" />
            <p className="font-medium text-text-primary">Nuevo Pedido</p>
          </Link>
          <Link
            to="/mozo/mesas"
            className="card card-hover text-center py-8"
          >
            <TableCellsIcon className="w-8 h-8 mx-auto text-primary-500 mb-3" />
            <p className="font-medium text-text-primary">Ver Mesas</p>
          </Link>
          <Link
            to="/cocina"
            className="card card-hover text-center py-8"
          >
            <ClockIcon className="w-8 h-8 mx-auto text-primary-500 mb-3" />
            <p className="font-medium text-text-primary">Cocina</p>
          </Link>
          <Link
            to="/reportes"
            className="card card-hover text-center py-8"
          >
            <CurrencyDollarIcon className="w-8 h-8 mx-auto text-primary-500 mb-3" />
            <p className="font-medium text-text-primary">Reportes</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
