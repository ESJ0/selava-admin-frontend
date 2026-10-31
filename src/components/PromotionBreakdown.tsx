import type { AppliedPromotion } from '../types/promotion'
import { money } from '../utils/adminFormat'
import { promotionMeasure } from '../utils/promotionFormat'

export function PromotionBreakdown({ promotion }: { promotion: AppliedPromotion }) {
  const mode = promotion.modalidad_cobro_aplicada
  return <article className="ad-promo">
    <h3 className="ad-disp">{promotion.nombre}</h3>
    <p>{promotion.tipo_prenda_nombre} · {promotionMeasure(promotion.medida_requerida, mode)} por {money(promotion.precio_promocional)}</p>
    <dl className="ad-kv3">
      <div><dt>Aplicaciones</dt><dd>{promotion.aplicaciones}</dd></div>
      <div><dt>Medida cubierta</dt><dd>{promotionMeasure(promotion.medida_cubierta, mode)}</dd></div>
      <div><dt>Importe promocional</dt><dd>{money(promotion.subtotal_promocional)}</dd></div>
      <div><dt>Sobrante</dt><dd>{`${promotionMeasure(promotion.sobrante, mode)} × ${money(promotion.precio_normal_aplicado)}`}</dd></div>
      <div><dt>Importe normal</dt><dd>{money(promotion.subtotal_normal)}</dd></div>
      <div><dt>Subtotal con promoción</dt><dd style={{ color: '#06709F' }}>{money(promotion.subtotal_total)}</dd></div>
    </dl>
  </article>
}
