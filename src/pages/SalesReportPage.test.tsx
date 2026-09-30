import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesReportPage } from './SalesReportPage'

const mocks = vi.hoisted(() => ({ getReport: vi.fn() }))

vi.mock('../api/reports', () => ({ getSalesReport: mocks.getReport }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Area: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const report = {
  fecha_inicio: '2026-09-01',
  fecha_fin: '2026-09-30',
  cantidad_ventas: 4,
  cantidad_pagos: 5,
  total_ventas: 500,
  ventas_por_dia: [
    { fecha: '2026-09-10', cantidad_ventas: 2, cantidad_pagos: 2, total_ventas: 200 },
    { fecha: '2026-09-11', cantidad_ventas: 2, cantidad_pagos: 3, total_ventas: 300 },
  ],
  ventas_por_metodo_pago: [
    { metodo_pago: { id: 1, nombre: 'Efectivo', activo: true }, cantidad_ventas: 3, cantidad_pagos: 4, total_ventas: 400 },
    { metodo_pago: { id: 2, nombre: 'Tarjeta', activo: true }, cantidad_ventas: 1, cantidad_pagos: 1, total_ventas: 100 },
  ],
}

describe('SalesReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getReport.mockResolvedValue(report)
  })

  it('muestra el resumen, la gráfica y los métodos de pago', async () => {
    render(<SalesReportPage/>)

    expect(await screen.findByText(/500\.00/)).toBeInTheDocument()
    expect(screen.getByText('Ventas por día')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gráfica de ventas por día' })).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('consulta nuevamente al aplicar un período válido', async () => {
    const user = userEvent.setup()
    render(<SalesReportPage/>)
    await screen.findByText(/500\.00/)

    const start = screen.getByLabelText('Fecha de inicio')
    const end = screen.getByLabelText('Fecha final')
    await user.clear(start)
    await user.type(start, '2026-08-01')
    await user.clear(end)
    await user.type(end, '2026-08-31')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtro' }))

    await waitFor(() => expect(mocks.getReport).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31', expect.any(AbortSignal)))
  })

  it('rechaza un período invertido antes de consultar la API', async () => {
    const user = userEvent.setup()
    render(<SalesReportPage/>)
    await screen.findByText(/500\.00/)
    const calls = mocks.getReport.mock.calls.length

    await user.clear(screen.getByLabelText('Fecha de inicio'))
    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-09-30')
    await user.clear(screen.getByLabelText('Fecha final'))
    await user.type(screen.getByLabelText('Fecha final'), '2026-09-01')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtro' }))

    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser posterior')
    expect(mocks.getReport).toHaveBeenCalledTimes(calls)
  })

  it('muestra un estado vacío cuando el período no tiene ventas', async () => {
    mocks.getReport.mockResolvedValueOnce({ ...report, cantidad_ventas: 0, cantidad_pagos: 0, total_ventas: 0, ventas_por_dia: [], ventas_por_metodo_pago: [] })
    render(<SalesReportPage/>)
    expect(await screen.findByText('No hay ventas en este período')).toBeInTheDocument()
    expect(screen.getByText('Sin pagos registrados')).toBeInTheDocument()
  })
})
