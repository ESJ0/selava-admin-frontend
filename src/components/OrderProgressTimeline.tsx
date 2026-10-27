import {
  Check,
  CircleCheckBig,
  CircleDashed,
  ClipboardCheck,
  PackageCheck,
  Sparkles,
  WashingMachine,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { EstadoFlujoPedido, FlujoOperativoPedido } from '../types'

function normalizedStage(stage: EstadoFlujoPedido) {
  return (stage.codigo || stage.nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
}

function stageIcon(stage: EstadoFlujoPedido): LucideIcon {
  const key = normalizedStage(stage)
  if (key.includes('RECIB')) return ClipboardCheck
  if (key.includes('SECAD')) return Wind
  if (key.includes('PLANCH')) return Sparkles
  if (key.includes('LAVAD')) return WashingMachine
  if (key.includes('RACK') || key.includes('LISTO')) return PackageCheck
  if (key.includes('FINAL')) return CircleCheckBig
  return CircleDashed
}

function stageStatus(stage: EstadoFlujoPedido) {
  if (stage.actual) return 'Estado actual'
  if (stage.completado) return 'Completado'
  return 'Pendiente'
}

export function OrderProgressTimeline({ flow }: { flow: FlujoOperativoPedido }) {
  const style = { '--stage-count': flow.estados.length } as CSSProperties

  return <div className="order-progress-content">
    <div className="progress-summary">
      <span>Avance general</span>
      <strong>{flow.progreso_porcentaje}%</strong>
    </div>
    <div className="flow-progress" role="progressbar" aria-label="Progreso del pedido" aria-valuemin={0} aria-valuemax={100} aria-valuenow={flow.progreso_porcentaje}>
      <span style={{ width: `${flow.progreso_porcentaje}%` }}/>
    </div>
    <ol className="order-progress-timeline" aria-label="Etapas del pedido" style={style}>
      {flow.estados.map(stage => {
        const Icon = stageIcon(stage)
        const status = stageStatus(stage)
        const stateClass = stage.actual ? 'current' : stage.completado ? 'done' : 'pending'
        return <li key={stage.id} className={`order-progress-stage ${stateClass}`} aria-label={`${stage.nombre}: ${status}`} aria-current={stage.actual ? 'step' : undefined}>
          <div className="stage-icon" role="img" aria-label={`Icono de ${stage.nombre}`}>
            <Icon aria-hidden="true" size={24}/>
            {stage.completado && !stage.actual && <span className="stage-check"><Check aria-hidden="true" size={12}/></span>}
          </div>
          <div className="stage-copy">
            <strong>{stage.nombre}</strong>
            <span className="stage-status">{status}</span>
            {stage.servicios.length > 0 && <small>Aplica por: {stage.servicios.map(service => service.nombre).join(', ')}</small>}
          </div>
        </li>
      })}
    </ol>
  </div>
}

