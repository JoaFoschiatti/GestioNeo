import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import useEventSource from '../../hooks/useEventSource'
import useAsync from '../../hooks/useAsync'
import { useAuth } from '../../context/AuthContext'
import { canAccessRouteByKey } from '../../config/permissions'
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const { usuario } = useAuth()
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
      link: null,
      featured: true
    },
    {
      name: 'Pedidos Hoy',
      value: data?.pedidosHoy || 0,
      icon: ShoppingCartIcon,
      link: null,
      featured: true
    },
    {
      name: 'Pedidos Pendientes',
      value: data?.pedidosPendientes || 0,
      icon: ClockIcon,
      highlight: data?.pedidosPendientes > 0,
      link: canAccessRouteByKey(usuario?.rol, 'pedidos') ? '/pedidos' : null
    },
    {
      name: 'Mesas Ocupadas',
      value: `${data?.mesasOcupadas || 0} / ${data?.mesasTotal || 0}`,
      icon: TableCellsIcon,
      link: canAccessRouteByKey(usuario?.rol, 'mesas') ? '/mesas' : null
    },
    {
      name: 'Alertas de Stock',
      value: data?.alertasStock || 0,
      icon: ExclamationTriangleIcon,
      highlight: data?.alertasStock > 0,
      isWarning: data?.alertasStock > 0,
      link: canAccessRouteByKey(usuario?.rol, 'ingredientes') ? '/ingredientes' : null
    },
    {
      name: 'Empleados Trabajando',
      value: data?.empleadosTrabajando || 0,
      icon: UsersIcon,
      link: null
    }
  ]

  const quickAccesses = [
    {
      to: '/mozo/nuevo-pedido',
      routeKey: 'mozoNuevoPedido',
      icon: ShoppingCartIcon,
      label: 'Nuevo Pedido'
    },
    {
      to: '/mesas',
      routeKey: 'mesas',
      icon: TableCellsIcon,
      label: 'Ver Mesas'
    },
    {
      to: '/cocina',
      routeKey: 'cocina',
      icon: ClockIcon,
      label: 'Cocina'
    },
    {
      to: '/reportes',
      routeKey: 'reportes',
      icon: CurrencyDollarIcon,
      label: 'Reportes'
    }
  ].filter(item => canAccessRouteByKey(usuario?.rol, item.routeKey))

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Card = stat.link ? Link : 'div'
          return (
            <Card
              key={stat.name}
              to={stat.link}
              className={`stat-card card-hover flex items-center gap-4 ${stat.link ? 'cursor-pointer' : ''} ${stat.featured ? 'lg:col-span-2' : ''}`}
            >
              <div className={`${stat.featured ? 'p-4' : 'p-3'} rounded-xl ${
                stat.isWarning
                  ? 'bg-warning-100'
                  : stat.highlight
                    ? 'bg-primary-100'
                    : 'bg-primary-50'
              }`}>
                <stat.icon className={`${stat.featured ? 'w-8 h-8' : 'w-6 h-6'} ${
                  stat.isWarning
                    ? 'text-warning-600'
                    : 'text-primary-500'
                }`} />
              </div>
              <div>
                <p className="stat-label">{stat.name}</p>
                <p className={stat.featured ? 'stat-value-lg' : 'stat-value'}>{stat.value}</p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Quick access */}
      <div className="mt-10">
        <h2 className="text-heading-3 mb-4">Accesos Rapidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickAccesses.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card card-hover text-center py-8"
            >
              <item.icon className="w-8 h-8 mx-auto text-primary-500 mb-3" />
              <p className="font-medium text-text-primary">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {data?.tiemposPromedio && (
        <div className="mt-10">
          <h2 className="text-heading-3 mb-4">Rendimiento Operativo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-text-tertiary">Prep. promedio</p>
              <p className="text-2xl font-bold text-text-primary">{data.tiemposPromedio.preparacionMin} min</p>
            </div>
            <div className="card">
              <p className="text-sm text-text-tertiary">Entrega promedio</p>
              <p className="text-2xl font-bold text-text-primary">{data.tiemposPromedio.entregaMin} min</p>
            </div>
            <div className="card">
              <p className="text-sm text-text-tertiary">Ciclo completo</p>
              <p className="text-2xl font-bold text-text-primary">{data.tiemposPromedio.cicloCompletoMin} min</p>
            </div>
          </div>
        </div>
      )}

      {data?.ventasPorCanalHoy && (
        <div className="mt-10">
          <h2 className="text-heading-3 mb-4">Mix por Canal (Hoy)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(data.ventasPorCanalHoy).map(([canal, resumen]) => (
              <div key={canal} className="card">
                <p className="text-sm text-text-tertiary">{canal}</p>
                <p className="text-xl font-bold text-text-primary">{resumen.cantidad} pedidos</p>
                <p className="text-sm text-text-secondary">
                  ${Number(resumen.total || 0).toLocaleString('es-AR')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
