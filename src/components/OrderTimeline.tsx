import { Check, Clock3 } from 'lucide-react'
import type { HistorialEstado } from '../types'

const dateTime = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function OrderTimeline({ history }: { history: HistorialEstado[] }) {
  if (!history.length) return <div className="empty-block"><Clock3 size={24}/><span>Este pedido todavía no tiene cambios registrados.</span></div>

  return <ol className="order-timeline" aria-label="Historial de estados">
    {history.map((entry, index) => <li key={entry.id} className={index === history.length - 1 ? 'latest' : ''}>
      <span className="timeline-dot"><Check size={14}/></span>
      <div className="timeline-entry">
        <header><strong>{entry.estado.nombre}</strong><time dateTime={entry.fecha_cambio}>{dateTime.format(new Date(entry.fecha_cambio))}</time></header>
        <p>Responsable: <b>{entry.usuario.nombre} {entry.usuario.apellido}</b></p>
        {entry.observaciones && <small>{entry.observaciones}</small>}
      </div>
    </li>)}
  </ol>
}
