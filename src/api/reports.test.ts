import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { getOrdersByStatusReport, getSalesReport } from './reports'

afterEach(() => vi.restoreAllMocks())

describe('contrato API de reportes', () => {
  it('envía el período y la señal de cancelación al endpoint de reportes', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { total_ventas: 0 } })
    const signal = new AbortController().signal

    await getSalesReport('2026-09-01', '2026-09-30', signal)

    expect(get).toHaveBeenCalledWith('/reportes/ventas', {
      params: { fecha_inicio: '2026-09-01', fecha_fin: '2026-09-30' },
      signal,
    })
  })

  it('consulta los pedidos por estado propagando la señal de cancelación', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { total_pedidos: 0, pedidos_por_estado: [] } })
    const signal = new AbortController().signal

    await getOrdersByStatusReport(signal)

    expect(get).toHaveBeenCalledWith('/reportes/pedidos-por-estado', { signal })
  })
})
