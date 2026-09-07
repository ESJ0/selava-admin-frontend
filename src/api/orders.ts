import { api } from './client'
import type { Cliente, Pedido, PrendaDraft, Servicio, TipoPrenda } from '../types'

export async function listClients() { return (await api.get<Cliente[]>('/clientes/')).data }
export async function listGarmentTypes() { return (await api.get<TipoPrenda[]>('/tipos-prenda/')).data }
export async function listServices() { return (await api.get<Servicio[]>('/servicios/')).data }

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
      ...(item.color.trim() && { color: item.color.trim() }),
      ...(item.descripcion.trim() && { descripcion: item.descripcion.trim() }),
      servicios: item.servicio_ids.map((servicio_id) => ({ servicio_id })),
    })),
  })).data
}
