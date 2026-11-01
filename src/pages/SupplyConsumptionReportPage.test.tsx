import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupplyConsumptionReportPage } from './SupplyConsumptionReportPage'

const mocks = vi.hoisted(() => ({ getReport: vi.fn(), exportPdf: vi.fn(), listInputs: vi.fn() }))
vi.mock('../api/inventory', () => ({ listInputs: mocks.listInputs }))

vi.mock('../api/reports', () => ({ getSupplyConsumptionReport: mocks.getReport }))
vi.mock('../utils/reportPdf', () => ({ exportSupplyConsumptionReportPdf: mocks.exportPdf }))

const report = {
  fecha_inicio: '2026-09-01',
  fecha_fin: '2026-09-30',
  cantidad_movimientos: 3,
  total_consumido: 20.5,
  consumo_por_insumo: [
    { insumo_id: 1, nombre: 'Detergente', unidad_medida: 'L', cantidad_movimientos: 2, cantidad_consumida: 12.5 },
    { insumo_id: 2, nombre: 'Bolsas', unidad_medida: 'unidad', cantidad_movimientos: 1, cantidad_consumida: 8 },
  ],
}

describe('SupplyConsumptionReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getReport.mockResolvedValue(report)
    mocks.listInputs.mockResolvedValue([{ id: 1, nombre: 'Detergente', unidad_medida: 'L', stock_actual: 20, stock_minimo: 5, activo: true, created_at: '', updated_at: '' }])
  })

  it('muestra el resumen, las barras, el detalle y la proyección', async () => {
    render(<SupplyConsumptionReportPage />)
    const chart = await screen.findByRole('img', { name: /Gráfica de consumo por insumo/ })
    expect(within(chart).getByText('12.5 L')).toBeInTheDocument()
    expect(within(chart).getByText('8 unidad')).toBeInTheDocument()
    expect(screen.getByText('Mayor consumo').previousElementSibling).toHaveTextContent('12.5 L')
    expect(screen.getByText('L · 2 movimientos')).toBeInTheDocument()
    expect(await screen.findByText('Proyección · Detergente')).toBeInTheDocument()
    expect(screen.getByText('0.42 L por día')).toBeInTheDocument()
    expect(screen.getByText('~36 días')).toBeInTheDocument()
  })

  it('consulta nuevamente al aplicar un período válido', async () => {
    render(<SupplyConsumptionReportPage />)
    await screen.findByRole('img', { name: /Gráfica de consumo por insumo/ })
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-08-31' } })
    await waitFor(() => expect(mocks.getReport).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31', expect.any(AbortSignal)))
  })

  it('rechaza un período invertido sin consultar nuevamente', async () => {
    render(<SupplyConsumptionReportPage />)
    await screen.findByRole('img', { name: /Gráfica de consumo por insumo/ })
    const calls = mocks.getReport.mock.calls.length
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-30' } })
    fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-09-01' } })
    expect(screen.getByRole('alert')).toHaveTextContent('debe ser anterior')
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(mocks.getReport).toHaveBeenCalledTimes(calls)
  })

  it('muestra un estado vacío si no hubo salidas de inventario', async () => {
    mocks.getReport.mockResolvedValue({ ...report, cantidad_movimientos: 0, total_consumido: 0, consumo_por_insumo: [] })
    render(<SupplyConsumptionReportPage />)
    expect(await screen.findByText('No hay salidas de inventario en este período.')).toBeInTheDocument()
    expect(screen.queryByText(/Proyección/)).not.toBeInTheDocument()
  })

  it('descarga el reporte consultado en PDF', async () => {
    const user = userEvent.setup()
    render(<SupplyConsumptionReportPage />)
    await screen.findByRole('img', { name: /Gráfica de consumo por insumo/ })
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(mocks.exportPdf).toHaveBeenCalledWith(report))
  })
})
