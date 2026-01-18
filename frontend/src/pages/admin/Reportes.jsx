import { useState, useEffect } from 'react'
import api from '../../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

// Colores para los gráficos
const COLORS_METODO = {
  EFECTIVO: '#22c55e',      // verde
  MERCADOPAGO: '#06b6d4',   // celeste
  TARJETA: '#8b5cf6',       // violeta
}

const COLORS_TIPO = {
  MESA: '#3b82f6',          // azul
  DELIVERY: '#f97316',      // naranja
  MOSTRADOR: '#6b7280',     // gris
}

// Componente: Top 5 Productos con ranking visual
const TopProductosRanking = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-4">Sin datos de productos</p>
  }

  const top5 = data.slice(0, 5)
  const maxVentas = Math.max(...top5.map(p => Number(p.totalVentas) || 0))
  const medals = ['🥇', '🥈', '🥉', '4.', '5.']
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#9CA3AF', '#9CA3AF']

  return (
    <div className="space-y-4">
      {top5.map((prod, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-2xl w-10 text-center">{medals[i]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-900 truncate pr-2">{prod.producto}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">{prod.cantidadVendida} uds</span>
            </div>
            <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: maxVentas > 0 ? `${(Number(prod.totalVentas) / maxVentas) * 100}%` : '0%',
                  backgroundColor: colors[i]
                }}
              />
            </div>
            <div className="text-right text-sm font-bold text-green-600 mt-1">
              ${Number(prod.totalVentas).toLocaleString('es-AR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Componente: Donut Chart genérico
const DonutChart = ({ data, colors, title, formatValue }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-4">Sin datos</p>
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0]
      const percentage = ((item.value / total) * 100).toFixed(1)
      return (
        <div className="bg-white px-3 py-2 shadow-lg rounded-lg border">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-gray-600">
            {formatValue ? formatValue(item.value) : item.value} ({percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => (
              <span className="text-sm text-gray-700">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// Componente: Ranking de Mozos
const VentasPorMozoRanking = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-4">Sin datos de mozos</p>
  }

  const maxVentas = Math.max(...data.map(m => Number(m.totalVentas) || 0))

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((mozo, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500 w-6">{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-900 truncate">{mozo.mozo}</span>
              <span className="text-xs text-gray-500">{mozo.pedidos} pedidos</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{
                  width: maxVentas > 0 ? `${(Number(mozo.totalVentas) / maxVentas) * 100}%` : '0%',
                }}
              />
            </div>
            <div className="text-right text-sm font-bold text-green-600 mt-1">
              ${Number(mozo.totalVentas).toLocaleString('es-AR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Reportes() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ventas, setVentas] = useState(null)
  const [productosMasVendidos, setProductosMasVendidos] = useState([])
  const [ventasPorMozo, setVentasPorMozo] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fechas por defecto: último mes
    const hoy = new Date()
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    setFechaHasta(hoy.toISOString().split('T')[0])
    setFechaDesde(hace30Dias.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      cargarReportes()
    }
  }, [fechaDesde, fechaHasta])

  const cargarReportes = async () => {
    setLoading(true)
    try {
      const [ventasRes, productosRes, mozosRes] = await Promise.all([
        api.get(`/reportes/ventas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`),
        api.get(`/reportes/productos-mas-vendidos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limite=10`),
        api.get(`/reportes/ventas-por-mozo?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`)
      ])
      setVentas(ventasRes.data)
      setProductosMasVendidos(productosRes.data)
      setVentasPorMozo(mozosRes.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Preparar datos para donut de métodos de pago
  const datosMetodosPago = ventas?.ventasPorMetodo
    ? Object.entries(ventas.ventasPorMetodo).map(([metodo, monto]) => ({
        name: metodo,
        value: parseFloat(monto) || 0,
        color: COLORS_METODO[metodo] || '#6b7280'
      })).filter(item => item.value > 0)
    : []

  // Preparar datos para donut de tipo de pedido
  const datosTipoPedido = ventas?.ventasPorTipo
    ? Object.entries(ventas.ventasPorTipo).map(([tipo, data]) => ({
        name: tipo,
        value: data.total || 0,
        cantidad: data.cantidad || 0,
        color: COLORS_TIPO[tipo] || '#6b7280'
      })).filter(item => item.value > 0)
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reportes</h1>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Desde</label>
            <input
              type="date"
              className="input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input
              type="date"
              className="input"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <button onClick={cargarReportes} className="btn btn-primary" disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {ventas && (
        <>
          {/* Resumen de ventas - KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-500">Total Ventas</p>
              <p className="text-2xl font-bold text-green-600">
                ${ventas.totalVentas?.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Total Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">{ventas.totalPedidos}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Ticket Promedio</p>
              <p className="text-2xl font-bold text-primary-600">
                ${ventas.ticketPromedio?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Ventas por Tipo</p>
              <div className="text-sm mt-2">
                {Object.entries(ventas.ventasPorTipo || {}).map(([tipo, data]) => (
                  <div key={tipo} className="flex justify-between">
                    <span>{tipo}:</span>
                    <span className="font-medium">{data.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 1: Top Productos + Métodos de Pago */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">🏆</span>
                Top 5 Productos por Ingresos
              </h3>
              <TopProductosRanking data={productosMasVendidos} />
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Métodos de Pago</h3>
              {datosMetodosPago.length > 0 ? (
                <DonutChart
                  data={datosMetodosPago}
                  colors={Object.values(COLORS_METODO)}
                  formatValue={(v) => `$${v.toLocaleString('es-AR')}`}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">Sin datos de pagos</p>
              )}
            </div>
          </div>

          {/* Fila 2: Tipo de Pedido + Ventas por Mozo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Tipo de Pedido</h3>
              {datosTipoPedido.length > 0 ? (
                <DonutChart
                  data={datosTipoPedido}
                  colors={Object.values(COLORS_TIPO)}
                  formatValue={(v) => `$${v.toLocaleString('es-AR')}`}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">Sin datos de pedidos</p>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">👤</span>
                Ventas por Mozo
              </h3>
              <VentasPorMozoRanking data={ventasPorMozo} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
