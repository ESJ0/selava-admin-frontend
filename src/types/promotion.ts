import type { ModalidadCobro } from '../types'

export interface PromotionPayload {
  nombre: string
  descripcion: string
  tipo_prenda_id: number
  modalidad_cobro: ModalidadCobro
  medida_requerida: number
  precio_promocional: number
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
}
export interface Promotion extends PromotionPayload { id: number; tipo_prenda_nombre: string; created_at: string; updated_at: string }
export interface PromotionSelection { tipo_prenda_id: number; promocion_id: number }
export interface AppliedPromotion {
  promocion_id: number
  nombre: string
  descripcion: string
  tipo_prenda_id: number
  tipo_prenda_nombre: string
  modalidad_cobro_aplicada: ModalidadCobro
  medida_requerida: number
  precio_promocional: number
  medida_disponible: number
  aplicaciones: number
  medida_cubierta: number
  sobrante: number
  precio_normal_aplicado: number
  subtotal_promocional: number
  subtotal_normal: number
  subtotal_base: number
  subtotal_total: number
  prenda_ids?: number[]
}
export interface PromotionQuoteGroup {
  tipo_prenda_id: number
  tipo_prenda_nombre: string
  modalidad_cobro: ModalidadCobro
  medida: number
  precio_normal: number
  subtotal_base: number
  subtotal_total: number
  elegibles: AppliedPromotion[]
  aplicada: AppliedPromotion | null
}
export interface PromotionQuote { grupos: PromotionQuoteGroup[]; total: number }
