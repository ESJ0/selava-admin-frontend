import { api } from './client'
import type { Cliente, EstadoPedido, HistorialEstado, Pedido, PedidoDetalle, PrendaDraft, Servicio, TipoPrenda } from '../types'

export async function listClients() { return (await api.get<Cliente[]>('/clientes/')).data }
export async function listGarmentTypes() { return (await api.get<TipoPrenda[]>('/tipos-prenda/')).data }
export async function listServices() { return (await api.get<Servicio[]>('/servicios/')).data }
export async function getOrder(id: number, signal?: AbortSignal) { return (await api.get<PedidoDetalle | null>(`/pedidos/${id}`, { signal })).data }
export async function getOrderHistory(id: number, signal?: AbortSignal) { return (await api.get<HistorialEstado[]>(`/pedidos/${id}/historial-estados`, { signal })).data }
export async function cancelOrder(id: number) { return (await api.put(`/pedidos/${id}/cancelar`)).data }
export async function listOrderStatuses(signal?: AbortSignal) { return (await api.get<EstadoPedido[]>('/estados-pedido/', { signal })).data }
export async function updateOrderStatus(id: number, estadoId: number, observaciones?: string) {
  return (await api.put(`/pedidos/${id}/estado`, {
    estado_id: estadoId,
    ...(observaciones?.trim() && { observaciones: observaciones.trim() }),
  })).data
}

// createOrder crea el pedido y todas sus prendas en una sola llamada:
// el backend lo procesa como una transacción atómica (POST /api/pedidos),
// también existe POST /api/pedidos/{id}/prendas para pedidos existentes.
export async function createOrder(clienteId: number, fechaEntregaEstimada: string, observaciones: string | undefined, garments: PrendaDraft[]) {
  return (await api.post<Pedido>('/pedidos/', {
    cliente_id: clienteId,
    fecha_entrega_estimada: new Date(`${fechaEntregaEstimada}T12:00:00`).toISOString(),
    ...(observaciones?.trim() && { observaciones: observaciones.trim() }),
    prendas: garments.flatMap((garment) => garment.detalles.map((detail) => ({
      tipo_prenda_id: garment.tipo_prenda_id,
      cantidad: detail.cantidad,
      servicios: detail.servicio_ids.map(servicioId => ({ servicio_id: servicioId })),
      ...(detail.color.trim() && { color: detail.color.trim() }),
      ...(detail.descripcion.trim() && { descripcion: detail.descripcion.trim() }),
    }))),
  })).data
}
