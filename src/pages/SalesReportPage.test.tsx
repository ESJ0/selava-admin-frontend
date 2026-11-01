import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesReportPage } from './SalesReportPage'

const mocks = vi.hoisted(() => ({ getReport: vi.fn(), exportPdf: vi.fn() }))

vi.mock('../api/reports', () => ({ getSalesReport: mocks.getReport }))
vi.mock('../utils/reportPdf', () => ({ exportSalesReportPdf: mocks.exportPdf }))

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

  it('carga el mes actual y muestra resumen, gráfica, métodos y lo destacado', async () => {
    render(<SalesReportPage />)
    expect(await screen.findByText('Q 500.00')).toBeInTheDocument()
    expect(mocks.getReport).toHaveBeenCalledWith(expect.stringMatching(/-01$/), expect.any(String), expect.any(AbortSignal))
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Q 125.00')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gráfica de ventas por día' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gráfica de ventas por día' }).querySelectorAll('.rp-pt')).toHaveLength(2)
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(within(screen.getByRole('img', { name: 'Gráfica de ventas por día' })).getByText('11-sept')).toBeInTheDocument()
    expect(screen.getAllByText(/Mejor día/)[0].closest('.rp-ins')).toHaveTextContent('Mejor día: 11-sept con Q 300.00.')
    expect(screen.getByText('5 pagos registrados')).toBeInTheDocument()
    expect(screen.getByText('+ Q 300.00')).toBeInTheDocument()
  })

  it('consulta otra vez al elegir un atajo o escribir fechas válidas', async () => {
    const user = userEvent.setup()
    render(<SalesReportPage />)
    await screen.findByText('Q 500.00')
    await user.click(screen.getByRole('button', { name: 'Últimos 30 días' }))
    await waitFor(() => expect(mocks.getReport).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-08-31' } })
    await waitFor(() => expect(mocks.getReport).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31', expect.any(AbortSignal)))
    expect(screen.getByText('Del 1 de agosto de 2026 al 31 de agosto de 2026')).toBeInTheDocument()
  })

  it('rechaza un período invertido antes de consultar la API', async () => {
    render(<SalesReportPage />)
    await screen.findByText('Q 500.00')
    const calls = mocks.getReport.mock.calls.length
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-30' } })
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-09-01' } })
    expect(screen.getByRole('alert')).toHaveTextContent('debe ser anterior')
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(mocks.getReport).toHaveBeenCalledTimes(calls)
  })

  it('muestra un estado vacío cuando el período no tiene ventas', async () => {
    mocks.getReport.mockResolvedValue({ ...report, cantidad_ventas: 0, cantidad_pagos: 0, total_ventas: 0, ventas_por_dia: [], ventas_por_metodo_pago: [] })
    render(<SalesReportPage />)
    expect(await screen.findByText('No hay pagos en este período.')).toBeInTheDocument()
    expect(screen.getByText('Sin pagos registrados.')).toBeInTheDocument()
  })

  it('muestra el error y permite reintentar', async () => {
    const user = userEvent.setup()
    mocks.getReport.mockRejectedValueOnce(new Error('network'))
    render(<SalesReportPage />)
    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Q 500.00')).toBeInTheDocument()
  })

  it('descarga el reporte consultado en PDF', async () => {
    const user = userEvent.setup()
    render(<SalesReportPage />)
    await screen.findByText('Q 500.00')
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(mocks.exportPdf).toHaveBeenCalledWith(report))
  })
})
