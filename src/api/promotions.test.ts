import { afterEach, expect, it, vi } from 'vitest'
import { api } from './client'
import { createOrder } from './orders'
import { listPromotions, quotePromotions, savePromotion, setPromotionActive } from './promotions'
import { promotion } from '../test/promotionFixtures'
import type { PrendaDraft } from '../types'

afterEach(() => vi.restoreAllMocks())
it('usa las rutas CRUD y propaga AbortSignal', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] }), post = vi.spyOn(api, 'post').mockResolvedValue({ data: promotion }), put = vi.spyOn(api, 'put').mockResolvedValue({ data: promotion }), patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: promotion })
  const signal = new AbortController().signal
  await listPromotions(signal); await savePromotion(promotion); await savePromotion(promotion, 8); await setPromotionActive(8, false)
  expect(get).toHaveBeenCalledWith('/promociones/', { signal }); expect(post).toHaveBeenCalledWith('/promociones/', promotion); expect(put).toHaveBeenCalledWith('/promociones/8', promotion); expect(patch).toHaveBeenCalledWith('/promociones/8/estado', { activo: false })
})
it('cotiza y guarda la misma medida; al crear solo envía IDs de promociones, nunca importes', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 42 } })
  const garments: PrendaDraft[] = [{ tipo_prenda_id: 2, cantidad: 5, aplicar_servicio_comun: false, servicio_ids_comunes: [], detalles: [{ cantidad: 5, color: '', descripcion: '', servicio_ids: [3, 4] }] }]
  const selections = [{ tipo_prenda_id: 2, promocion_id: 8, aplicaciones: 999, subtotal_total: 0.01 }]
  await quotePromotions(garments, selections); await createOrder(1, '2026-12-01', '', garments, selections)
  const quote = post.mock.calls[0][1] as Record<string, unknown>, order = post.mock.calls[1][1] as Record<string, unknown>
  expect(quote.prendas).toEqual(order.prendas)
  expect(order.promociones).toEqual([{ tipo_prenda_id: 2, promocion_id: 8 }])
  expect(order).not.toHaveProperty('total'); expect(order).not.toHaveProperty('subtotal_total')
})
