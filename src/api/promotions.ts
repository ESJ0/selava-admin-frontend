import { api } from './client'
import { orderGarmentsPayload } from './orders'
import type { PrendaDraft } from '../types'
import type { Promotion, PromotionPayload, PromotionQuote, PromotionSelection } from '../types/promotion'

export async function listPromotions(signal?: AbortSignal) { return (await api.get<Promotion[]>('/promociones/', { signal })).data }
export async function savePromotion(payload: PromotionPayload, id?: number) { return (await (id ? api.put<Promotion>(`/promociones/${id}`, payload) : api.post<Promotion>('/promociones/', payload))).data }
export async function setPromotionActive(id: number, activo: boolean) { return (await api.patch<Promotion>(`/promociones/${id}/estado`, { activo })).data }
export async function quotePromotions(garments: PrendaDraft[], selections: PromotionSelection[], signal?: AbortSignal) {
  return (await api.post<PromotionQuote>('/pedidos/cotizacion', { prendas: orderGarmentsPayload(garments), promociones: selections }, { signal })).data
}
