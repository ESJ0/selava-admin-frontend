import { useEffect, useState } from 'react'
import { quotePromotions } from '../api/promotions'
import { errorMessage } from '../api/client'
import type { PrendaDraft } from '../types'
import type { PromotionQuote, PromotionSelection } from '../types/promotion'
import { PromotionBreakdown } from './PromotionBreakdown'
import { promotionMeasure, promotionMoney } from '../utils/promotionFormat'

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
  return <section className="order-promotions" aria-label="Promociones del pedido">
    <h2>Promociones disponibles</h2><p>Elige una promoción por tipo de prenda. Al guardar se vuelve a comprobar su vigencia y precio.</p>
    <button type="button" className="secondary" onClick={() => { onStatus(null); setReload(value => value + 1) }}>Actualizar cotización</button>
    {error ? <div role="alert" className="alert error">{error}<button type="button" onClick={() => setReload(value => value + 1)}>Reintentar cotización</button>{selections.length > 0 && <button type="button" onClick={() => { onStatus(null); setSelections([]) }}>Quitar promociones</button>}</div> : !quote ? <p role="status">Calculando promociones y total…</p> : <>
      {quote.grupos.map(group => <div key={group.tipo_prenda_id} className="promotion-choice">
        <label>Promoción para {group.tipo_prenda_nombre}<select value={selections.find(p => p.tipo_prenda_id === group.tipo_prenda_id)?.promocion_id ?? ''} onChange={event => select(group.tipo_prenda_id, Number(event.target.value))}>
          <option value="">Sin promoción</option>{group.elegibles.map(p => <option key={p.promocion_id} value={p.promocion_id}>{p.nombre}</option>)}
        </select></label>
        <p>{promotionMeasure(group.medida, group.modalidad_cobro)} · Importe normal {promotionMoney(group.subtotal_base)}</p>
        {!group.elegibles.length && <p>No hay promociones elegibles para esta medida.</p>}
        {group.aplicada && <PromotionBreakdown promotion={group.aplicada} />}
      </div>)}
    </>}
  </section>
}
