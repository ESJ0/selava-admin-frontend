import { AlertTriangle, CheckCircle2, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import type { FlujoOperativoPedido } from '../types'
import { Modal } from './Modal'

function isFinalStage(flow: FlujoOperativoPedido) {
  const next = flow.siguiente_estado
  if (!next) return false
  const normalized = next.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return next.codigo === 'FINALIZADO' || (next.es_terminal === true && next.es_cancelacion !== true) || normalized === 'finalizado'
}

interface OrderStateControlProps {
  flow: FlujoOperativoPedido
  observations: string
  submitting: boolean
  onObservationsChange: (value: string) => void
  onAdvance: () => void
}

export function OrderStateControl({ flow, observations, submitting, onObservationsChange, onAdvance }: OrderStateControlProps) {
  const [confirmFinal, setConfirmFinal] = useState(false)
  const next = flow.siguiente_estado

  function requestAdvance() {
    if (!next || submitting) return
    if (isFinalStage(flow)) {
      setConfirmFinal(true)
      return
    }
    onAdvance()
  }

  function confirmAdvance() {
    setConfirmFinal(false)
    onAdvance()
  }

  return <>
    <section className="detail-card state-update-card" aria-busy={submitting}>
      <header><PackageCheck size={20}/><h2>Actualizar estado</h2></header>
      {next ? <>
        <p>Siguiente etapa: <strong>{next.nombre}</strong></p>
        <label>Observaciones<textarea aria-label="Observaciones" disabled={submitting} value={observations} onChange={event => onObservationsChange(event.target.value)} maxLength={255} placeholder="Agrega una nota opcional…"/></label>
        <button className="primary wide" disabled={submitting} onClick={requestAdvance}>{submitting ? 'Actualizando…' : `Avanzar a ${next.nombre}`}</button>
      </> : <div className={`completed-state ${flow.cancelado ? 'cancelled' : ''}`}><CheckCircle2 size={25}/><span>{flow.cancelado ? 'Este pedido fue cancelado.' : 'El flujo operativo está finalizado.'}</span></div>}
    </section>

    {confirmFinal && <Modal title="Finalizar pedido" onClose={() => !submitting && setConfirmFinal(false)}><div className="confirm-modal final-state-confirmation"><span className="warning-icon"><AlertTriangle size={30}/></span><p>¿Confirmas que el pedido completó todas sus etapas y puede marcarse como <strong>Finalizado</strong>? Este cambio cerrará el flujo operativo.</p><footer><button className="secondary" disabled={submitting} onClick={() => setConfirmFinal(false)}>Volver</button><button className="primary" disabled={submitting} onClick={confirmAdvance}>{submitting ? 'Finalizando…' : 'Sí, finalizar pedido'}</button></footer></div></Modal>}
  </>
}

