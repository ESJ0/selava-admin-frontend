import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrdersByStatusReportPage } from './OrdersByStatusReportPage'

const mocks = vi.hoisted(() => ({ getReport: vi.fn(), exportPdf: vi.fn() }))

vi.mock('../api/reports', () => ({ getOrdersByStatusReport: mocks.getReport }))
vi.mock('../utils/reportPdf', () => ({ exportOrdersByStatusReportPdf: mocks.exportPdf }))

const report = {
  fecha_inicio: '2026-09-01',
  fecha_fin: '2026-09-30',
  total_pedidos: 8,
  pedidos_por_estado: [
    { estado: { id: 1, nombre: 'Recibido', orden: 1 }, cantidad_pedidos: 5 },
    { estado: { id: 2, nombre: 'Rackeado', orden: 2 }, cantidad_pedidos: 2 },
    { estado: { id: 3, nombre: 'Entregado', orden: 3 }, cantidad_pedidos: 1 },
    { estado: { id: 4, nombre: 'Cancelado', orden: 4 }, cantidad_pedidos: 0 },
  ],
}

describe('OrdersByStatusReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getReport.mockResolvedValue(report)
  })

  it('muestra el resumen, la dona y todos los estados en orden', async () => {
    const user = userEvent.setup()
    render(<OrdersByStatusReportPage />)
    const donut = await screen.findByRole('img', { name: /Gráfica de pedidos por estado/ })
    expect(donut.querySelectorAll('.rp-arc')).toHaveLength(3)
    expect(screen.getByText('De 4 estados registrados')).toBeInTheDocument()
    expect(screen.getByText('5 pedidos · 63% del total')).toBeInTheDocument()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual(['1Recibido5 62.5%', '2Rackeado2 25%', '3Entregado1 12.5%', '4Cancelado0 0%'])
    expect(rows[3]).toHaveClass('zero')
    expect(screen.getByText(/de los pedidos sigue en/)).toHaveTextContent('El 63% de los pedidos sigue en Recibido.')
    await user.hover(screen.getByRole('button', { name: /Rackeado/ }))
    expect(screen.getByText('Rackeado · 25%')).toBeInTheDocument()
  })

  it('aplica un rango de fechas y permite descargar el PDF', async () => {
    const user = userEvent.setup()
    render(<OrdersByStatusReportPage />)
    await screen.findByRole('img', { name: /Gráfica de pedidos por estado/ })
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-08-31' } })
    await waitFor(() => expect(mocks.getReport).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31', expect.any(AbortSignal)))
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(mocks.exportPdf).toHaveBeenCalledWith(report))
  })

  it('rechaza un período invertido antes de consultar la API', async () => {
    render(<OrdersByStatusReportPage />)
    await screen.findByRole('img', { name: /Gráfica de pedidos por estado/ })
    const calls = mocks.getReport.mock.calls.length
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-30' } })
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-09-01' } })
    expect(screen.getByRole('alert')).toHaveTextContent('debe ser anterior')
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(mocks.getReport).toHaveBeenCalledTimes(calls)
  })

  it('muestra el estado vacío cuando no hay pedidos activos', async () => {
    mocks.getReport.mockResolvedValue({ ...report, total_pedidos: 0, pedidos_por_estado: report.pedidos_por_estado.map((item) => ({ ...item, cantidad_pedidos: 0 })) })
    render(<OrdersByStatusReportPage />)
    expect(await screen.findByText('No hay pedidos activos en este período.')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
