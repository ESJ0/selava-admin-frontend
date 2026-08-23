import { api } from './client'
import type { Cliente, Pedido, PrendaDraft, TipoPrenda } from '../types'

export async function listClients() { return (await api.get<Cliente[]>('/clientes/')).data }
export async function listGarmentTypes() { return (await api.get<TipoPrenda[]>('/tipos-prenda/')).data }
export async function createOrder(clienteId: number) { return (await api.post<Pedido>('/pedidos/', { cliente_id: clienteId })).data }
export async function addGarments(pedidoId: number, garments: PrendaDraft[]) {
  return (await api.post(`/pedidos/${pedidoId}/prendas`, garments.map((item) => ({ tipo_prenda_id: item.tipo_prenda_id, cantidad: item.cantidad,
    ...(item.color.trim() && { color: item.color.trim() }), ...(item.descripcion.trim() && { descripcion: item.descripcion.trim() }) })))).data
}
