import type { CSSProperties } from 'react'
import type { EstadoFlujoPedido, FlujoOperativoPedido } from '../types'
import { stageIcon, stageKey } from '../utils/adminFormat'

function stageStatus(stage: EstadoFlujoPedido, last: boolean) {
  if (stage.actual) return last ? 'Completado' : 'Estado actual'
  if (stage.completado) return 'Completado'
  return 'Pendiente'
}

/** Riel de tintorería con la prenda colgada y las estaciones del flujo real. */
export function OrderProgressTimeline({ flow }: { flow: FlujoOperativoPedido }) {
  const stages = flow.estados
  const cancelled = flow.cancelado
  const currentIndex = Math.max(0, stages.findIndex(stage => stage.actual) >= 0 ? stages.findIndex(stage => stage.actual) : stages.reduce((last, stage, index) => stage.completado ? index : last, 0))
  const railPct = stages.length > 1 ? (currentIndex / (stages.length - 1)) * 100 : 0
  const currentKey = stages[currentIndex] ? stageKey(stages[currentIndex]) : ''
  const showSteam = !cancelled && currentKey.includes('PLANCH')
  const showDrops = !cancelled && currentKey.includes('LAVAD')

  return <div role="group" aria-label={`Progreso del pedido: ${flow.progreso_porcentaje}%`}>
    <div className="ad-rail" aria-hidden="true">
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6, borderRadius: 6, background: '#1C4458' }} />
      <div className="ad-rfill" style={{ position: 'absolute', left: 0, top: 0, width: `${railPct}%`, height: 6, borderRadius: 6, background: cancelled ? '#F08A63' : '#5BC3EC' }} />
      <div className="ad-carr" style={{ position: 'absolute', top: -6, left: `${railPct}%`, width: 0 }}>
        <div className={`ad-hang${cancelled ? ' still' : ''}`} style={{ position: 'absolute', left: -36, top: 0, width: 72 }}>
          <svg width="72" height="112" viewBox="0 0 76 120">
            <path d="M38 2 a6 6 0 1 1 6 6 c-3 0-6 2-6 6 v4" fill="none" stroke="#C9D8DF" strokeWidth="3" strokeLinecap="round" />
            <path d="M38 18 L6 38 H70 Z" fill="none" stroke="#C9D8DF" strokeWidth="3" strokeLinejoin="round" />
            <path d="M20 36 L58 36 L60 116 L44 116 L38 64 L32 116 L16 116 Z" fill={cancelled ? '#6F8C9B' : '#fff'} />
            <path d="M20 46 H58" stroke="#9DB3BE" strokeWidth="2" />
          </svg>
          {showSteam && <><span className="ad-steam" style={{ left: 12, top: 60 }} /><span className="ad-steam" style={{ left: 32, top: 54, animationDelay: '.8s' }} /><span className="ad-steam" style={{ left: 50, top: 62, animationDelay: '1.6s' }} /></>}
          {showDrops && <><span className="ad-drop2" style={{ left: 18 }} /><span className="ad-drop2" style={{ left: 36, animationDelay: '.5s' }} /><span className="ad-drop2" style={{ left: 52, animationDelay: '1s' }} /></>}
        </div>
      </div>
    </div>
    <ol className="ad-stations" aria-label="Etapas del pedido" style={{ '--n': stages.length, '--stage-count': stages.length } as CSSProperties}>
      {stages.map((stage, index) => {
        const last = index === stages.length - 1
        const status = stageStatus(stage, last)
        const done = !cancelled && (stage.completado && !stage.actual || (stage.actual && last))
        const now = !cancelled && stage.actual && !last
        const cls = `ad-stn${done ? ' done' : now ? ' now' : ''}${cancelled ? ' off' : ''}`
        const tag = cancelled ? (index <= currentIndex ? 'Detenido' : '—') : status
        const tagColor = cancelled ? '#F08A63' : done ? '#5BC3EC' : now ? '#FFC93C' : '#6F8C9B'
        return <li key={stage.id} className={stage.actual && !last ? 'current' : stage.completado || stage.actual ? 'done' : 'pending'} aria-label={`${stage.nombre}: ${status}`} aria-current={stage.actual ? 'step' : undefined}>
          <span className={cls} role="img" aria-label={`Icono de ${stage.nombre}`}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={stageIcon(stage)} /></svg></span>
          <span className="lbl" style={{ color: cancelled ? '#6F8C9B' : index <= currentIndex ? '#fff' : '#8AA3B0' }}>{stage.nombre}</span>
          <span className="tag" style={{ color: tagColor }}>{tag}</span>
          {stage.servicios.length > 0 && <span className="svc">Aplica por: {stage.servicios.map(service => service.nombre).join(', ')}</span>}
        </li>
      })}
    </ol>
  </div>
}
