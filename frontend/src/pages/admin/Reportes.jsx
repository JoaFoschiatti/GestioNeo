import React, { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import useAsync from '../../hooks/useAsync'

// Colores para los graficos
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
const TopProductosRanking = ({ data, agrupadoPorBase }) => {
  const [expandedItems, setExpandedItems] = useState({})

  if (!data || data.length === 0) {
    return <p className="text-text-secondary text-center py-4">Sin datos de productos</p>
  }

  const top5 = data.slice(0, 5)
  const maxVentas = Math.max(...top5.map(p => Number(p.totalVentas) || 0))
  const medals = ['1.', '2.', '3.', '4.', '5.']
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#9CA3AF', '#9CA3AF']

  const toggleExpand = (index) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="space-y-4">
      {top5.map((prod, i) => (
        <div key={i}>
          <div className="flex items-center gap-3">
            {agrupadoPorBase && prod.variantes && prod.variantes.length > 0 && (
              <button
                onClick={() => toggleExpand(i)}
                type="button"
                className="p-1 hover:bg-surface-hover rounded"
                aria-label={`${expandedItems[i] ? 'Contraer' : 'Expandir'} variantes de ${prod.producto}`}
              >
                {expandedItems[i]
                  ? <ChevronDownIcon className="w-4 h-4 text-text-tertiary" />
                  : <ChevronRightIcon className="w-4 h-4 text-text-tertiary" />
                }
              </button>
            )}
            <span className="text-2xl w-10 text-center">{medals[i]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-text-primary truncate pr-2">{prod.producto}</span>
                <span className="text-xs text-text-tertiary whitespace-nowrap">{prod.cantidadVendida} uds</span>
              </div>
              <div className="h-5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: maxVentas > 0 ? `${(Number(prod.totalVentas) / maxVentas) * 100}%` : '0%',
                    backgroundColor: colors[i]
                  }}
                />
              </div>
              <div className="text-right text-sm font-bold text-success-600 mt-1">
                ${Number(prod.totalVentas).toLocaleString('es-AR')}
              </div>
            </div>
          </div>
          {/* Detalle de variantes */}
          {agrupadoPorBase && prod.variantes && prod.variantes.length > 0 && expandedItems[i] && (
            <div className="ml-16 mt-2 space-y-1">
              {prod.variantes.map((v, vi) => (
                <div key={vi} className="flex justify-between text-sm text-text-secondary bg-surface-hover px-3 py-1.5 rounded">
                  <span>{v.nombreVariante || v.nombre}</span>
                  <span>{v.cantidadVendida} uds - ${Number(v.totalVentas).toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Componente: Donut Chart generico
const DonutChart = ({ data, colors, formatValue }) => {
  if (!data || data.length === 0) {
    return <p className="text-text-secondary text-center py-4">Sin datos</p>
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0]
      const percentage = ((item.value / total) * 100).toFixed(1)
      return (
        <div className="bg-surface px-3 py-2 shadow-lg rounded-lg border border-border-default">
          <p className="font-medium text-text-primary">{item.name}</p>
          <p className="text-sm text-text-secondary">
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
            formatter={(value) => (
              <span className="text-sm text-text-primary">{value}</span>
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
    return <p className="text-text-secondary text-center py-4">Sin datos de mozos</p>
  }

  const maxVentas = Math.max(...data.map(m => Number(m.totalVentas) || 0))

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((mozo, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-tertiary w-6">{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-text-primary truncate">{mozo.mozo}</span>
              <span className="text-xs text-text-tertiary">{mozo.pedidos} pedidos</span>
            </div>
            <div className="h-4 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{
                  width: maxVentas > 0 ? `${(Number(mozo.totalVentas) / maxVentas) * 100}%` : '0%',
                }}
              />
            </div>
            <div className="text-right text-sm font-bold text-success-600 mt-1">
              ${Number(mozo.totalVentas).toLocaleString('es-AR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Componente: Consumo de Insumos
const ConsumoInsumosTable = ({ data }) => {
  const [expandedItems, setExpandedItems] = useState({})

  if (!data || !data.ingredientes || data.ingredientes.length === 0) {
    return <p className="text-text-secondary text-center py-4">Sin datos de consumo</p>
  }

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div>
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-surface-hover p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-text-primary">{data.resumen.totalIngredientes}</p>
          <p className="text-xs text-text-tertiary">Ingredientes</p>
        </div>
        <div className="bg-error-50 p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-error-600">{data.resumen.ingredientesBajoStock}</p>
          <p className="text-xs text-text-tertiary">Bajo Stock</p>
        </div>
        <div className="bg-success-50 p-3 rounded-lg text-center">
          <p className="text-lg font-bold text-success-600">
            ${data.resumen.costoTotalEstimado?.toLocaleString('es-AR', { maximumFractionDigits: 0 }) || '-'}
          </p>
          <p className="text-xs text-text-tertiary">Costo Total</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-border-default rounded-xl overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th className="text-left">Ingrediente</th>
              <th className="text-right">Consumo</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.ingredientes.slice(0, 10).map((ing) => (
              <React.Fragment key={ing.ingredienteId}>
                <tr className="hover:bg-surface-hover">
                  <td>
                    <div className="flex items-center gap-2">
                      {ing.detalleProductos && ing.detalleProductos.length > 0 && (
                        <button
                          onClick={() => toggleExpand(ing.ingredienteId)}
                          type="button"
                          className="p-0.5 hover:bg-surface-hover rounded"
                          aria-label={`${expandedItems[ing.ingredienteId] ? 'Contraer' : 'Expandir'} detalle de ${ing.nombre}`}
                        >
                          {expandedItems[ing.ingredienteId]
                            ? <ChevronDownIcon className="w-4 h-4 text-text-tertiary" />
                            : <ChevronRightIcon className="w-4 h-4 text-text-tertiary" />
                          }
                        </button>
                      )}
                      <span className="font-medium text-text-primary">{ing.nombre}</span>
                    </div>
                  </td>
                  <td className="text-right text-text-secondary">
                    {ing.consumoTotal.toFixed(2)} {ing.unidad}
                  </td>
                  <td className="text-right text-text-secondary">
                    {ing.stockActual.toFixed(2)} {ing.unidad}
                  </td>
                  <td className="text-right">
                    <span className={`badge ${
                      ing.estado === 'BAJO' ? 'badge-error' : 'badge-success'
                    }`}>
                      {ing.estado}
                    </span>
                  </td>
                </tr>
                {/* Detalle de productos */}
                {expandedItems[ing.ingredienteId] && ing.detalleProductos && (
                  <tr>
                    <td colSpan={4} className="bg-surface-hover px-6 py-2">
                      <div className="text-xs space-y-1">
                        {ing.detalleProductos.map((prod, pi) => (
                          <div key={pi} className="flex justify-between text-text-secondary">
                            <span>
                              {prod.producto}
                              {prod.multiplicador !== 1 && (
                                <span className="text-primary-600 ml-1">(x{prod.multiplicador})</span>
                              )}
                            </span>
                            <span>{prod.cantidad} uds = {prod.consumo.toFixed(2)} {ing.unidad}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Reportes() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ventas, setVentas] = useState(null)
  const [productosMasVendidos, setProductosMasVendidos] = useState([])
  const [ventasPorMozo, setVentasPorMozo] = useState([])
  const [consumoInsumos, setConsumoInsumos] = useState(null)
  const [agruparPorBase, setAgruparPorBase] = useState(false)
  const [tabActiva, setTabActiva] = useState('ventas')

  useEffect(() => {
    // Fechas por defecto: ultimo mes
    const hoy = new Date()
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    setFechaHasta(hoy.toISOString().split('T')[0])
    setFechaDesde(hace30Dias.toISOString().split('T')[0])
  }, [])

  const cargarReportes = useCallback(async () => {
    // Cargar reportes en paralelo pero manejar errores individualmente
    const results = await Promise.allSettled([
      api.get(`/reportes/ventas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
      api.get(`/reportes/productos-mas-vendidos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limite=10&agruparPorBase=${agruparPorBase}`, { skipToast: true }),
      api.get(`/reportes/ventas-por-mozo?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true }),
      api.get(`/reportes/consumo-insumos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`, { skipToast: true })
    ])

    if (results[0].status === 'fulfilled') {
      setVentas(results[0].value.data)
    } else {
      console.error('Error en ventas:', results[0].reason)
    }

    if (results[1].status === 'fulfilled') {
      setProductosMasVendidos(results[1].value.data || [])
    } else {
      console.error('Error en productos:', results[1].reason)
      setProductosMasVendidos([])
    }

    if (results[2].status === 'fulfilled') {
      setVentasPorMozo(results[2].value.data || [])
    } else {
      console.error('Error en mozos:', results[2].reason)
      setVentasPorMozo([])
    }

    if (results[3].status === 'fulfilled') {
      setConsumoInsumos(results[3].value.data)
    } else {
      console.error('Error en consumo:', results[3].reason)
      setConsumoInsumos({ resumen: { totalIngredientes: 0, ingredientesBajoStock: 0, costoTotalEstimado: 0 }, ingredientes: [] })
    }

    // Si todos fallaron, mostrar error
    const allFailed = results.every(r => r.status === 'rejected')
    if (allFailed) {
      toast.error('Error al cargar reportes')
    }
  }, [agruparPorBase, fechaDesde, fechaHasta])

  const handleLoadError = useCallback((error) => {
    console.error('Error general:', error)
    toast.error('Error al cargar reportes')
  }, [])

  const cargarReportesRequest = useCallback(async (_ctx) => (
    cargarReportes()
  ), [cargarReportes])

  const { loading: loadingReportes, execute: cargarReportesAsync } = useAsync(
    cargarReportesRequest,
    { immediate: false, onError: handleLoadError }
  )

  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      cargarReportesAsync()
    }
  }, [fechaDesde, fechaHasta, cargarReportesAsync])

  // Preparar datos para donut de metodos de pago
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
      <h1 className="text-heading-1 mb-6">Reportes</h1>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label" htmlFor="reportes-fecha-desde">Desde</label>
            <input
              id="reportes-fecha-desde"
              type="date"
              className="input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="reportes-fecha-hasta">Hasta</label>
            <input
              id="reportes-fecha-hasta"
              type="date"
              className="input"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <button onClick={cargarReportesAsync} className="btn btn-primary" disabled={loadingReportes}>
            {loadingReportes ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        <button
          onClick={() => setTabActiva('ventas')}
          className={`tab ${tabActiva === 'ventas' ? 'tab-active' : ''}`}
        >
          Ventas
        </button>
        <button
          onClick={() => setTabActiva('insumos')}
          className={`tab ${tabActiva === 'insumos' ? 'tab-active' : ''}`}
        >
          Consumo de Insumos
        </button>
      </div>

      {tabActiva === 'ventas' && ventas && (
        <>
          {/* Resumen de ventas - KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-text-secondary">Total Ventas</p>
              <p className="text-2xl font-bold text-success-600">
                ${ventas.totalVentas?.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Total Pedidos</p>
              <p className="text-2xl font-bold text-text-primary">{ventas.totalPedidos}</p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Ticket Promedio</p>
              <p className="text-2xl font-bold text-primary-600">
                ${ventas.ticketPromedio?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-text-secondary">Ventas por Tipo</p>
              <div className="text-sm mt-2">
                {Object.entries(ventas.ventasPorTipo || {}).map(([tipo, data]) => (
                  <div key={tipo} className="flex justify-between text-text-secondary">
                    <span>{tipo}:</span>
                    <span className="font-medium text-text-primary">{data.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 1: Top Productos + Metodos de Pago */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-heading-3 flex items-center gap-2">
                  <span className="text-xl">1.</span>
                  Top 5 Productos por Ingresos
                </h3>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={agruparPorBase}
                    onChange={(e) => setAgruparPorBase(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-text-secondary">Agrupar variantes</span>
                </label>
              </div>
              <TopProductosRanking data={productosMasVendidos} agrupadoPorBase={agruparPorBase} />
            </div>

            <div className="card">
              <h3 className="text-heading-3 mb-4">Metodos de Pago</h3>
              {datosMetodosPago.length > 0 ? (
                <DonutChart
                  data={datosMetodosPago}
                  colors={Object.values(COLORS_METODO)}
                  formatValue={(v) => `$${v.toLocaleString('es-AR')}`}
                />
              ) : (
                <p className="text-text-secondary text-center py-8">Sin datos de pagos</p>
              )}
            </div>
          </div>

          {/* Fila 2: Tipo de Pedido + Ventas por Mozo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="text-heading-3 mb-4">Tipo de Pedido</h3>
              {datosTipoPedido.length > 0 ? (
                <DonutChart
                  data={datosTipoPedido}
                  colors={Object.values(COLORS_TIPO)}
                  formatValue={(v) => `$${v.toLocaleString('es-AR')}`}
                />
              ) : (
                <p className="text-text-secondary text-center py-8">Sin datos de pedidos</p>
              )}
            </div>

            <div className="card">
              <h3 className="text-heading-3 mb-4 flex items-center gap-2">
                <span className="text-xl">2.</span>
                Ventas por Mozo
              </h3>
              <VentasPorMozoRanking data={ventasPorMozo} />
            </div>
          </div>
        </>
      )}

      {tabActiva === 'insumos' && (
        <div className="card">
          <h3 className="text-heading-3 mb-4 flex items-center gap-2">
            <span className="text-xl">3.</span>
            Consumo de Insumos
            <span className="text-sm font-normal text-text-tertiary">(con multiplicadores de variantes)</span>
          </h3>
          <ConsumoInsumosTable data={consumoInsumos} />
        </div>
      )}
    </div>
  )
}
