import { useState } from 'react'
import type { FlujoOperativoPedido } from '../types'
import { ConfirmDialog } from './admin/AdminBits'
import { ArrowRightIcon, CheckIcon, CloseIcon, SpinnerIcon } from './admin/icons'

function isFinalStage(flow: FlujoOperativoPedido) {
  const next = flow.siguiente_estado
  if (!next) return false
  const normalized = next.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return next.codigo === 'FINALIZADO' || (next.es_terminal === true && next.es_cancelacion !== true) || normalized === 'finalizado'
}

interface OrderStateControlProps {
  flow: FlujoOperativoPedido
  observations: string
  submitting: boolean
  onObservationsChange: (value: string) => void
  onAdvance: () => void
  currentLabel?: string
}

export function OrderStateControl({ flow, observations, submitting, onObservationsChange, onAdvance, currentLabel }: OrderStateControlProps) {
  const [confirmFinal, setConfirmFinal] = useState(false)
  const next = flow.siguiente_estado
  const current = currentLabel ?? flow.estados.find(stage => stage.actual)?.nombre

  function requestAdvance() {
    if (!next || submitting) return
    if (isFinalStage(flow)) { setConfirmFinal(true); return }
    onAdvance()
  }

  return <>
    <section className="ad-adv ad-st" style={{ animationDelay: '.22s' }} aria-busy={submitting} aria-labelledby="advance-title">
      {next ? <>
        <h2 id="advance-title" style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#5BC3EC' }}>Actualizar estado</h2>
        <div className="ad-nextst">
          {current && <span className="ad-nfrom">{current}</span>}
          <svg className="ad-narr" width="28" height="16" viewBox="0 0 28 16" fill="none" stroke="#FFC93C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 8h22M18 2l6 6-6 6" /></svg>
          <span className="ad-nto ad-disp">{next.nombre}</span>
        </div>
        <label htmlFor="advance-notes" style={{ display: 'block', margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#C9D8E0' }}>Observaciones</label>
        <textarea id="advance-notes" className="ad-ta" rows={3} disabled={submitting} value={observations} onChange={event => onObservationsChange(event.target.value)} maxLength={255} placeholder="Agrega una nota opcional…" />
        <button className="ad-advb" type="button" disabled={submitting} onClick={requestAdvance} aria-label={submitting ? 'Actualizando…' : `Avanzar a ${next.nombre}`}>
          <span>{submitting ? 'Actualizando…' : `Avanzar a ${next.nombre}`}</span>
          <span className="ad">{submitting ? <SpinnerIcon className="ad-spin" size={18} /> : <ArrowRightIcon size={18} strokeWidth={2.6} />}</span>
        </button>
      </> : <div className="ad-pop" style={{ textAlign: 'center', padding: '10px 0' }}>
        <h2 id="advance-title" className="ad-sr">Actualizar estado</h2>
        <span style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: flow.cancelado ? '#F08A63' : '#7EE0B5', color: '#0A2433', alignItems: 'center', justifyContent: 'center' }}>{flow.cancelado ? <CloseIcon size={30} strokeWidth={2.6} /> : <CheckIcon size={30} />}</span>
        <p className="ad-disp" style={{ margin: '14px 0 4px', fontSize: 24, fontWeight: 800 }}>{flow.cancelado ? 'Pedido cancelado' : 'Pedido finalizado'}</p>
        <p style={{ margin: 0, color: '#A9C1CD', fontSize: 14 }}>{flow.cancelado ? 'Este pedido fue cancelado y ya no avanzará en la planta.' : 'El flujo operativo está finalizado.'}</p>
      </div>}
    </section>

    {confirmFinal && <ConfirmDialog title="Finalizar pedido" tone="info" icon={<CheckIcon size={30} />} confirmLabel="Sí, finalizar pedido" busyLabel="Finalizando…" busy={submitting} onClose={() => setConfirmFinal(false)} onConfirm={() => { setConfirmFinal(false); onAdvance() }}>
      <p style={{ margin: 0 }}>¿Confirmas que el pedido completó todas sus etapas y puede marcarse como <strong>Finalizado</strong>? Este cambio cerrará el flujo operativo.</p>
    </ConfirmDialog>}
  </>
}
