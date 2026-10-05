import { api } from './client'
import type { ReporteConsumoInsumos, ReportePedidosPorEstado, ReporteVentas } from '../types'

export async function getSalesReport(fechaInicio: string, fechaFin: string, signal?: AbortSignal) {
  return (await api.get<ReporteVentas>('/reportes/ventas', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    signal,
  })).data
}

export async function getOrdersByStatusReport(signal?: AbortSignal) {
  return (await api.get<ReportePedidosPorEstado>('/reportes/pedidos-por-estado', { signal })).data
}

export async function getSupplyConsumptionReport(fechaInicio: string, fechaFin: string, signal?: AbortSignal) {
  return (await api.get<ReporteConsumoInsumos>('/reportes/consumo-insumos', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    signal,
  })).data
}
