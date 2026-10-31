import { useEffect, useState } from 'react'
import { quotePromotions } from '../api/promotions'
import { errorMessage } from '../api/client'
import type { PrendaDraft } from '../types'
import type { PromotionQuote, PromotionSelection } from '../types/promotion'
import { promotionMeasure } from '../utils/promotionFormat'
import { money } from '../utils/adminFormat'
import { RefreshIcon } from './admin/icons'
import { PromotionBreakdown } from './PromotionBreakdown'

export interface PromotionOrderState { quote: PromotionQuote; selections: PromotionSelection[]; ready: boolean }

export function PromotionOrderQuote({ garments, onStatus }: { garments: PrendaDraft[]; onStatus: (state: PromotionOrderState | null) => void }) {
  const [selections, setSelections] = useState<PromotionSelection[]>([])
  const [response, setResponse] = useState<{ key: string; quote: PromotionQuote } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [reload, setReload] = useState(0)
  const requestKey = JSON.stringify([garments, selections, reload])
  const quote = response?.key === requestKey ? response.quote : null
  const error = failure?.key === requestKey ? failure.message : ''
  useEffect(() => {
    const controller = new AbortController()
    onStatus(null)
    quotePromotions(garments, selections, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setResponse({ key: requestKey, quote: result }); onStatus({ quote: result, selections, ready: true })
    }).catch(cause => { if (!controller.signal.aborted) setFailure({ key: requestKey, message: errorMessage(cause) }) })
    return () => { controller.abort() }
  }, [garments, selections, reload, onStatus, requestKey])

  function select(typeId: number, id: number) {
    onStatus(null)
    setSelections(current => [...current.filter(p => p.tipo_prenda_id !== typeId), ...(id ? [{ tipo_prenda_id: typeId, promocion_id: id }] : [])])
  }

  const quoting = !quote && !error
  return <section className="ad-promo2" aria-label="Promociones del pedido">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div><h2 className="ad-disp" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Promociones disponibles</h2><p style={{ margin: '4px 0 0', fontSize: 14, color: '#3E5866' }}>Elige una promoción por tipo de prenda. Al guardar se vuelve a comprobar su vigencia y precio.</p></div>
      <button type="button" className="ad-quote" onClick={() => { onStatus(null); setReload(value => value + 1) }}><RefreshIcon className={quoting ? 'ad-spin' : undefined} size={16} />{quoting ? 'Actualizando…' : 'Actualizar cotización'}</button>
    </div>
    {error ? <div className="ad-err2" role="alert" style={{ flexWrap: 'wrap' }}>{error}
      <button type="button" className="ad-quote" style={{ height: 36 }} onClick={() => setReload(value => value + 1)}>Reintentar cotización</button>
      {selections.length > 0 && <button type="button" className="ad-quote" style={{ height: 36 }} onClick={() => { onStatus(null); setSelections([]) }}>Quitar promociones</button>}
    </div> : !quote ? <p role="status" style={{ margin: '14px 0 0', color: '#5A7280' }}>Calculando promociones y total…</p> : <>
      {quote.grupos.map(group => {
        const current = selections.find(p => p.tipo_prenda_id === group.tipo_prenda_id)?.promocion_id ?? 0
        const savings = group.aplicada ? group.subtotal_base - group.subtotal_total : 0
        return <div key={group.tipo_prenda_id} style={{ marginTop: 16 }}>
          <p className="ad-lbl2" id={`promo-${group.tipo_prenda_id}`}>Promoción para {group.tipo_prenda_nombre}</p>
          <div className="ad-popts" role="radiogroup" aria-labelledby={`promo-${group.tipo_prenda_id}`}>
            <button type="button" role="radio" className="ad-po" aria-checked={!current} onClick={() => select(group.tipo_prenda_id, 0)}><b>Sin promoción</b><small>{money(group.subtotal_base)}</small></button>
            {group.elegibles.map(promotion => <button key={promotion.promocion_id} type="button" role="radio" className="ad-po" aria-checked={current === promotion.promocion_id} onClick={() => select(group.tipo_prenda_id, promotion.promocion_id)}>
              <b>{promotion.nombre}</b>
              <small>{promotion.aplicaciones} × {promotionMeasure(promotion.medida_requerida, promotion.modalidad_cobro_aplicada)}{promotion.sobrante > 0 ? ` + ${promotionMeasure(promotion.sobrante, promotion.modalidad_cobro_aplicada)} normal` : ''} = {money(promotion.subtotal_total)}</small>
            </button>)}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#5A7280' }}>{promotionMeasure(group.medida, group.modalidad_cobro)} · Importe normal {money(group.subtotal_base)}{savings > 0 ? ` · Ahorras ${money(savings)}` : ''}</p>
          {!group.elegibles.length && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5A7280' }}>No hay promociones elegibles para esta medida.</p>}
          {group.aplicada && <PromotionBreakdown promotion={group.aplicada} />}
        </div>
      })}
    </>}
  </section>
}
