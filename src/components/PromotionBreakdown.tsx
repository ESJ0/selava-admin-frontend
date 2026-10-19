import type { AppliedPromotion } from '../types/promotion'
import { promotionMeasure, promotionMoney } from '../utils/promotionFormat'

export function PromotionBreakdown({ promotion }: { promotion: AppliedPromotion }) {
  return <article className="promotion-breakdown">
    <h3>{promotion.nombre}</h3>
    <p>{promotion.tipo_prenda_nombre} · {promotionMeasure(promotion.medida_requerida, promotion.modalidad_cobro_aplicada)} por {promotionMoney(promotion.precio_promocional)}</p>
    <dl>
      <div><dt>Aplicaciones</dt><dd>{promotion.aplicaciones}</dd></div>
      <div><dt>Medida cubierta</dt><dd>{promotionMeasure(promotion.medida_cubierta, promotion.modalidad_cobro_aplicada)}</dd></div>
      <div><dt>Importe promocional</dt><dd>{promotionMoney(promotion.subtotal_promocional)}</dd></div>
      <div><dt>Sobrante</dt><dd>{promotionMeasure(promotion.sobrante, promotion.modalidad_cobro_aplicada)} × {promotionMoney(promotion.precio_normal_aplicado)}</dd></div>
      <div><dt>Importe normal</dt><dd>{promotionMoney(promotion.subtotal_normal)}</dd></div>
      <div><dt>Subtotal con promoción</dt><dd>{promotionMoney(promotion.subtotal_total)}</dd></div>
    </dl>
  </article>
}
