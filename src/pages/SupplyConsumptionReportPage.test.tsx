import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupplyConsumptionReportPage } from './SupplyConsumptionReportPage'

const mocks = vi.hoisted(() => ({ getReport: vi.fn() }))

vi.mock('../api/reports', () => ({ getSupplyConsumptionReport: mocks.getReport }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const input = (id: number, nombre: string, unidad_medida: string) => ({
  id,
  nombre,
  unidad_medida,
  stock_actual: 20,
  stock_minimo: 5,
  activo: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
})

const report = {
  fecha_inicio: '2026-09-01',
  fecha_fin: '2026-09-30',
  consumo_por_insumo: [
    { insumo: input(1, 'Detergente', 'L'), cantidad_consumida: 12.5 },
    { insumo: input(2, 'Bolsas', 'unidad'), cantidad_consumida: 8 },
  ],
}

describe('SupplyConsumptionReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getReport.mockResolvedValue(report)
  })

  it('muestra el resumen, la gráfica y el detalle del consumo', async () => {
    render(<SupplyConsumptionReportPage/>)

    const summary = await screen.findByLabelText('Resumen de consumo de insumos')
    expect(within(summary).getByText('Insumos consumidos').nextElementSibling).toHaveTextContent('2')
    expect(within(summary).getByText('12.5 L')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gráfica de consumo de insumos por período' })).toBeInTheDocument()
    expect(screen.getAllByText('Detergente')).toHaveLength(2)
    expect(screen.getByText('8 unidad')).toBeInTheDocument()
  })

  it('consulta nuevamente al aplicar un período válido', async () => {
    const user = userEvent.setup()
    render(<SupplyConsumptionReportPage/>)
    await screen.findByLabelText('Resumen de consumo de insumos')

    await user.clear(screen.getByLabelText('Fecha de inicio'))
    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-08-01')
    await user.clear(screen.getByLabelText('Fecha final'))
    await user.type(screen.getByLabelText('Fecha final'), '2026-08-31')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtro' }))

    await waitFor(() => expect(mocks.getReport).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31', expect.any(AbortSignal)))
  })

  it('rechaza un período invertido sin consultar nuevamente', async () => {
    const user = userEvent.setup()
    render(<SupplyConsumptionReportPage/>)
    await screen.findByLabelText('Resumen de consumo de insumos')
    const calls = mocks.getReport.mock.calls.length

    await user.clear(screen.getByLabelText('Fecha de inicio'))
    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-09-30')
    await user.clear(screen.getByLabelText('Fecha final'))
    await user.type(screen.getByLabelText('Fecha final'), '2026-09-01')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtro' }))

    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser posterior')
    expect(mocks.getReport).toHaveBeenCalledTimes(calls)
  })

  it('muestra un estado vacío si no hubo salidas de inventario', async () => {
    mocks.getReport.mockResolvedValueOnce({ ...report, consumo_por_insumo: [] })
    render(<SupplyConsumptionReportPage/>)

    expect(await screen.findByText('No hay consumo en este período')).toBeInTheDocument()
    expect(screen.getByText('Sin salidas registradas')).toBeInTheDocument()
  })
})
