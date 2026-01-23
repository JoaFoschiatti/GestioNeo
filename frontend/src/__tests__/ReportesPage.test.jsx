import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import Reportes from '../pages/admin/Reportes'
import api from '../services/api'
import toast from 'react-hot-toast'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('recharts', () => ({
  PieChart: ({ children }) => <div data-testid="PieChart">{children}</div>,
  Pie: ({ children }) => <div data-testid="Pie">{children}</div>,
  Cell: () => <div data-testid="Cell" />,
  ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
  Tooltip: () => <div data-testid="Tooltip" />,
  Legend: () => <div data-testid="Legend" />
}))

describe('Reportes page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga reportes con skipToast usando las fechas por defecto', async () => {
    const hoy = new Date()
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)
    const fechaHasta = hoy.toISOString().split('T')[0]
    const fechaDesde = hace30Dias.toISOString().split('T')[0]

    api.get
      .mockResolvedValueOnce({
        data: {
          totalVentas: 0,
          totalPedidos: 0,
          ticketPromedio: 0,
          ventasPorMetodo: {},
          ventasPorTipo: {}
        }
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: {
          resumen: { totalIngredientes: 0, ingredientesBajoStock: 0, costoTotalEstimado: 0 },
          ingredientes: []
        }
      })

    render(<Reportes />)

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(4)
    })

    expect(screen.getByLabelText('Desde')).toHaveValue(fechaDesde)
    expect(screen.getByLabelText('Hasta')).toHaveValue(fechaHasta)

    expect(api.get).toHaveBeenCalledWith(
      `/reportes/ventas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`,
      expect.objectContaining({ skipToast: true })
    )
    expect(api.get).toHaveBeenCalledWith(
      `/reportes/productos-mas-vendidos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limite=10&agruparPorBase=false`,
      expect.objectContaining({ skipToast: true })
    )
    expect(api.get).toHaveBeenCalledWith(
      `/reportes/ventas-por-mozo?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`,
      expect.objectContaining({ skipToast: true })
    )
    expect(api.get).toHaveBeenCalledWith(
      `/reportes/consumo-insumos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`,
      expect.objectContaining({ skipToast: true })
    )
  })

  it('muestra un solo toast si fallan todos los reportes', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockRejectedValue(new Error('fail'))

    render(<Reportes />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al cargar reportes')
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})
