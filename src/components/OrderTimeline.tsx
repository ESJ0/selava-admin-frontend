import type { HistorialEstado } from '../types'
import { formatDateTime, isCancelled } from '../utils/adminFormat'
import { CheckIcon, ClockIcon, CloseIcon } from './admin/icons'

/** Historial de estados: el cambio más reciente primero. */
export function OrderTimeline({ history }: { history: HistorialEstado[] }) {
  if (!history.length) return <p style={{ margin: 0, padding: 16, borderRadius: 14, border: '1.5px dashed #DCE7EC', color: '#5A7280', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}><ClockIcon size={20} />Este pedido todavía no tiene cambios registrados.</p>

  const latestFirst = [...history].sort((a, b) => {
    const difference = new Date(b.fecha_cambio).getTime() - new Date(a.fecha_cambio).getTime()
    return difference || b.id - a.id
  })

  return <ol aria-label="Historial de estados" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
    {latestFirst.map((entry, index) => {
      const cancelled = isCancelled(entry.estado)
      return <li key={entry.id} className={`ad-hrow${index === 0 ? ' latest' : ''}`} style={{ animationDelay: `${Math.min(index, 8) * 0.06}s` }}>
        <span className={`ad-hdot2 ${cancelled ? 'x' : 'ok'}${index === 0 ? ' latest' : ''}`}>{cancelled ? <CloseIcon size={14} strokeWidth={3} /> : <CheckIcon size={14} strokeWidth={3} />}</span>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><p style={{ margin: 0, fontWeight: 600, fontSize: 17 }}>{entry.estado.nombre}</p><time dateTime={entry.fecha_cambio} style={{ fontSize: 13, color: '#5A7280' }}>{formatDateTime(entry.fecha_cambio)}</time></div>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: '#3E5866' }}>Responsable: <strong style={{ color: '#06709F' }}>{entry.usuario ? `${entry.usuario.nombre} ${entry.usuario.apellido}` : `Usuario #${entry.usuario_id}`}</strong></p>
          {entry.observaciones && <p className="ad-hnote">{entry.observaciones}</p>}
        </div>
      </li>
    })}
  </ol>
}
