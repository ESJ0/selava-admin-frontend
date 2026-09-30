import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrdersByStatusReportPage } from './OrdersByStatusReportPage'

const mocks = vi.hoisted(() => ({ getReport: vi.fn() }))

vi.mock('../api/reports', () => ({ getOrdersByStatusReport: mocks.getReport }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Pie: ({ children }: { children: React.ReactNode }) => <g>{children}</g>,
  Cell: () => null,
  Tooltip: () => null,
}))

const report = {
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

  it('muestra el resumen, la gráfica y todos los estados', async () => {
    render(<OrdersByStatusReportPage/>)

    const summary = await screen.findByLabelText('Resumen de pedidos por estado')
    expect(within(summary).getByText('8')).toBeInTheDocument()
    expect(within(summary).getByText('3')).toBeInTheDocument()
    expect(within(summary).getByText('Recibido')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gráfica de pedidos por estado' })).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByText('0% del total')).toBeInTheDocument()
  })

  it('actualiza el reporte bajo demanda', async () => {
    const user = userEvent.setup()
    render(<OrdersByStatusReportPage/>)
    await screen.findByLabelText('Resumen de pedidos por estado')

    await user.click(screen.getByRole('button', { name: 'Actualizar' }))

    await waitFor(() => expect(mocks.getReport).toHaveBeenCalledTimes(2))
    expect(mocks.getReport).toHaveBeenLastCalledWith(expect.any(AbortSignal))
  })

  it('muestra el estado vacío cuando no hay pedidos activos', async () => {
    mocks.getReport.mockResolvedValueOnce({ ...report, total_pedidos: 0, pedidos_por_estado: report.pedidos_por_estado.map((item) => ({ ...item, cantidad_pedidos: 0 })) })
    render(<OrdersByStatusReportPage/>)

    expect(await screen.findByText('No hay pedidos activos')).toBeInTheDocument()
    expect(screen.getByText('Sin pedidos')).toBeInTheDocument()
  })
})
