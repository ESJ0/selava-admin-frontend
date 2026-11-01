import { useState, type ReactNode } from 'react'
import { PRESETS, longDay, type Period, type PresetKey } from '../../hooks/useReport'
import { CatalogHead } from './CatalogKit'
import { PathIcon, SpinnerIcon } from './icons'

/** Encabezado de reporte con botón "Descargar PDF". */
export function ReportHead({ title, sub, onPdf }: { title: string; sub: string; onPdf?: () => void }) {
  const [busy, setBusy] = useState(false)
  function download() {
    if (!onPdf || busy) return
    setBusy(true)
    window.setTimeout(() => { try { onPdf() } finally { setBusy(false) } }, 0)
  }
  return <CatalogHead eyebrow="Reportes" title={title} sub={sub}>
    <button className="ct-secb pdf" type="button" disabled={!onPdf || busy} onClick={download}>
      {busy ? <SpinnerIcon className="ct-spin" size={20} /> : <PathIcon d="M12 4v11M7 10l5 5 5-5M4 20h16" size={20} strokeWidth={2.2} />}
      {busy ? 'Generando PDF…' : 'Descargar PDF'}
    </button>
  </CatalogHead>
}

export function PeriodBar({ period, badRange, onPick, onFrom, onTo }: { period: Period; badRange: boolean; onPick: (key: PresetKey) => void; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  return <>
    <section className="rp-period ad-st" style={{ animationDelay: '.18s' }} aria-label="Período del reporte">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 220 }}>
        <span className="rp-hi2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg></span>
        <span><span className="ad-disp" style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>Período del reporte</span><span style={{ fontSize: 13, color: '#5A7280' }}>{badRange ? 'Rango inválido' : `Del ${longDay(period.from)} al ${longDay(period.to)}`}</span></span>
      </div>
      <div className="rp-presets">{PRESETS.map(([key, label]) => <button key={key} type="button" className="rp-pre" aria-pressed={period.preset === key} onClick={() => onPick(key)}>{label}</button>)}</div>
      <label className="rp-dfield"><span>Desde</span><input type="date" aria-label="Fecha de inicio" value={period.from} onChange={(event) => onFrom(event.target.value)} /></label>
      <label className="rp-dfield"><span>Hasta</span><input type="date" aria-label="Fecha final" value={period.to} onChange={(event) => onTo(event.target.value)} /></label>
    </section>
    {badRange && <p className="rp-err" role="alert">La fecha "Desde" debe ser anterior a "Hasta".</p>}
  </>
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <p className="rp-err" role="alert">{message}<button type="button" onClick={onRetry}>Reintentar</button></p>
}

export function Kpi({ dark, icon, iconBg, iconFg, value, valueStyle, label, sub, delay }: { dark?: boolean; icon: ReactNode; iconBg: string; iconFg: string; value: ReactNode; valueStyle?: React.CSSProperties; label: string; sub: ReactNode; delay: number }) {
  return <div className={`rp-kc${dark ? ' dark' : ''}`} style={{ animationDelay: `${delay}s` }}>
    <span className="ki" style={{ background: iconBg, color: iconFg }}>{icon}</span>
    <p className="kn" style={valueStyle}>{value}</p>
    <p className="kl">{label}</p>
    <p className="ks">{sub}</p>
  </div>
}

export function PanelHead({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return <div className="rp-ph2"><div><h2>{title}</h2><p>{sub}</p></div>{children}</div>
}

export function Insight({ icon, children }: { icon: string; children: ReactNode }) {
  return <div className="rp-ins"><span className="ii"><PathIcon d={icon} size={18} strokeWidth={2.2} /></span><span>{children}</span></div>
}
