import { api } from './client'
import type { Cliente, EstadoPedido, HistorialEstado, Pedido, PedidoDetalle, PrendaDraft, Servicio, TipoPrenda } from '../types'

export async function listClients() { return (await api.get<Cliente[]>('/clientes/')).data }
export async function listGarmentTypes() { return (await api.get<TipoPrenda[]>('/tipos-prenda/')).data }
export async function listServices() { return (await api.get<Servicio[]>('/servicios/')).data }
export async function getOrder(id: number) { return (await api.get<PedidoDetalle>(`/pedidos/${id}`)).data }
export async function getOrderHistory(id: number) { return (await api.get<HistorialEstado[]>(`/pedidos/${id}/historial-estados`)).data }
export async function cancelOrder(id: number) { return (await api.put(`/pedidos/${id}/cancelar`)).data }
export async function listOrderStatuses() { return (await api.get<EstadoPedido[]>('/estados-pedido/')).data }
export async function updateOrderStatus(id: number, estadoId: number, observaciones?: string) {
  return (await api.put(`/pedidos/${id}/estado`, {
    estado_id: estadoId,
    ...(observaciones?.trim() && { observaciones: observaciones.trim() }),
  })).data
}

// createOrder crea el pedido y todas sus prendas en una sola llamada:
// el backend lo procesa como una transacción atómica (POST /api/pedidos),
// no existe un endpoint separado para registrar prendas después.
export async function createOrder(clienteId: number, fechaEntregaEstimada: string, observaciones: string | undefined, garments: PrendaDraft[]) {
  return (await api.post<Pedido>('/pedidos/', {
    cliente_id: clienteId,
    fecha_entrega_estimada: new Date(`${fechaEntregaEstimada}T12:00:00`).toISOString(),
    ...(observaciones?.trim() && { observaciones: observaciones.trim() }),
    prendas: garments.map((item) => ({
      tipo_prenda_id: item.tipo_prenda_id,
      cantidad: item.cantidad,
      servicios: item.servicio_ids.map(servicioId => ({ servicio_id: servicioId })),
      ...(item.color.trim() && { color: item.color.trim() }),
      ...(item.descripcion.trim() && { descripcion: item.descripcion.trim() }),
    })),
  })).data
}
