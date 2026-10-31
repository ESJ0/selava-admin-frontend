import { useEffect, type ReactNode } from 'react'
import type { EstadoPedido } from '../../types'
import { stageLook } from '../../utils/adminFormat'
import { AlertIcon } from './icons'

export function StatusChip({ status }: { status: EstadoPedido }) {
  const [bg, dot] = stageLook(status)
  return <span className="ad-chip" style={{ background: bg }}><i style={{ background: dot }} />{status.nombre}</span>
}

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busyLabel?: string
  busy?: boolean
  tone?: 'danger' | 'info'
  icon?: ReactNode
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Volver', busyLabel, busy = false, tone = 'danger', icon, onConfirm, onClose }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  return <>
    <div className="ad-ov" onClick={() => { if (!busy) onClose() }} />
    <div className="ad-cmdl" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <span className={`ad-warnic${tone === 'info' ? ' info' : ''}`}>{icon ?? <AlertIcon size={30} />}</span>
      <h2 id="confirm-title" className="ad-disp" style={{ margin: '16px 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h2>
      <div style={{ margin: '0 0 4px', color: '#3E5866' }}>{children}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="ad-keep" type="button" disabled={busy} onClick={onClose}>{cancelLabel}</button>
        <button className={`ad-doCancel${tone === 'info' ? ' ok' : ''}`} type="button" disabled={busy} onClick={onConfirm}>{busy ? busyLabel ?? 'Procesando…' : confirmLabel}</button>
      </div>
    </div>
  </>
}

export function Pager({ page, pages, label, onChange, nameSuffix = '' }: { page: number; pages: number; label: string; onChange: (page: number) => void; nameSuffix?: string }) {
  return <div className="ad-pager">
    <button className="ad-pg" type="button" aria-label={`Página anterior${nameSuffix}`} disabled={page <= 1} onClick={() => onChange(page - 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
    <span>{label}</span>
    <button className="ad-pg" type="button" aria-label={`Página siguiente${nameSuffix}`} disabled={page >= pages} onClick={() => onChange(page + 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
  </div>
}
