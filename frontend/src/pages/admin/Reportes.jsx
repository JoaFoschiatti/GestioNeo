import { useState, useEffect } from 'react'
import api from '../../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Reportes() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ventas, setVentas] = useState(null)
  const [productosMasVendidos, setProductosMasVendidos] = useState([])
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
      const [ventasRes, productosRes] = await Promise.all([
        api.get(`/reportes/ventas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`),
        api.get(`/reportes/productos-mas-vendidos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limite=10`)
      ])
      setVentas(ventasRes.data)
      setProductosMasVendidos(productosRes.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

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
          {/* Resumen de ventas */}
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
                    <span className="font-medium">{data.cantidad} (${data.total?.toLocaleString('es-AR')})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ventas por método de pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Ventas por Método de Pago</h3>
              <div className="space-y-3">
                {Object.entries(ventas.ventasPorMetodo || {}).map(([metodo, monto]) => (
                  <div key={metodo} className="flex justify-between items-center">
                    <span className="text-gray-600">{metodo}</span>
                    <span className="font-medium text-gray-900">
                      ${parseFloat(monto).toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Productos más vendidos */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Productos Más Vendidos</h3>
              <div className="space-y-3">
                {productosMasVendidos.slice(0, 5).map((prod, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-900">{prod.producto}</span>
                      <span className="text-sm text-gray-500 ml-2">({prod.categoria})</span>
                    </div>
                    <span className="font-medium text-primary-600">{prod.cantidadVendida} uds.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gráfico de productos más vendidos */}
          {productosMasVendidos.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Gráfico de Ventas por Producto</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productosMasVendidos.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="producto" type="category" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} unidades`, 'Vendidos']}
                    />
                    <Bar dataKey="cantidadVendida" fill="#eb7615" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
