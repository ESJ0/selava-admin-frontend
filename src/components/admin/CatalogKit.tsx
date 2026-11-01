import { useEffect, useId, type ReactNode } from 'react'
import { CheckIcon, CloseIcon, EditIcon, PlusIcon, RefreshIcon, SearchIcon, SpinnerIcon } from './icons'

const delay = (seconds: number) => ({ animationDelay: `${seconds}s` })

/** Encabezado de catálogo: ceja, título con punto celeste, subtítulo y acciones. */
export function CatalogHead({ title, sub, children, eyebrow = 'Catálogos' }: { title: string; sub: string; children?: ReactNode; eyebrow?: string }) {
  return <section className="ct-ph">
    <div>
      <p className="ct-eyb ad-st">{eyebrow}</p>
      <h1 className="ct-ttl ad-st" style={delay(.05)}>{title}<em>.</em></h1>
      <p className="ct-sub ad-st" style={delay(.1)}>{sub}</p>
    </div>
    {children && <div className="ct-btns ad-st" style={delay(.14)}>{children}</div>}
  </section>
}

export function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="ct-newc" type="button" onClick={onClick}><span className="pl"><PlusIcon size={20} strokeWidth={2.6} /></span>{label}</button>
}

export function CatalogTools({ query, onQuery, placeholder, tabs, tab, onTab }: { query: string; onQuery: (value: string) => void; placeholder: string; tabs: string[]; tab: number; onTab: (index: number) => void }) {
  return <section className="ct-tools ad-st" style={delay(.22)}>
    <label className="ct-srch"><SearchIcon size={20} /><span className="ad-sr">Buscar</span><input type="search" placeholder={placeholder} value={query} onChange={(event) => onQuery(event.target.value)} /></label>
    <div role="tablist" aria-label="Filtrar por estado" className="ct-segs">
      <span className="ct-spill" style={{ transform: `translateX(${tab * 112}px)` }} />
      {tabs.map((label, index) => <button key={label} type="button" role="tab" aria-selected={index === tab} onClick={() => onTab(index)}>{label}</button>)}
    </div>
  </section>
}

/** Interruptor Activo/Inactivo del pie de cada tarjeta. Sin permisos se muestra como indicador. */
export function ActiveSwitch({ active, name, onToggle, busy, labels = ['Activo', 'Inactivo'] }: { active: boolean; name: string; onToggle?: () => void; busy?: boolean; labels?: [string, string] }) {
  const content = <><span className="ct-trk"><span className="ct-knb" /></span><span>{active ? labels[0] : labels[1]}</span></>
  if (!onToggle) return <span className="ct-sw ro" role="switch" aria-checked={active} aria-readonly="true" aria-label={`Estado de ${name}`}>{content}</span>
  return <button className="ct-sw" type="button" role="switch" aria-checked={active} aria-label={`Activar o desactivar ${name}`} disabled={busy} onClick={onToggle}>{content}</button>
}

export function EditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return <button className="ct-edb" type="button" aria-label={`Editar ${name}`} onClick={onClick}><EditIcon size={16} />Editar</button>
}

export function CardFoot({ children }: { children: ReactNode }) {
  return <div className="ct-cfoot">{children}</div>
}

export function EmptyCard({ title, text }: { title: string; text: string }) {
  return <div className="ct-empty"><p>{title}</p><p>{text}</p></div>
}

export function LoadingCard({ text }: { text: string }) {
  return <div className="ct-loading" role="status"><SpinnerIcon className="ct-spin" size={28} />{text}</div>
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="ct-banner" role="alert"><span>{message}</span>{onRetry && <button type="button" onClick={onRetry}><RefreshIcon size={16} />Reintentar</button>}</div>
}

/** Modal del diseño: cabecera oscura con vista previa, cuerpo en dos columnas y acciones. */
export function CatalogModal({ eyebrow, title, width, preview, busy, onClose, onSubmit, saveLabel, busyLabel = 'Guardando…', children, formLabel }: {
  eyebrow: string; title: string; width?: number; preview: ReactNode; busy: boolean; onClose: () => void; onSubmit: () => void; saveLabel: string; busyLabel?: string; children: ReactNode; formLabel?: string
}) {
  const titleId = useId()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  return <>
    <div className="ct-ov" onClick={() => { if (!busy) onClose() }} />
    <div className="ct-mdl" role="dialog" aria-modal="true" aria-labelledby={titleId} style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}>
      <div className="ct-mtop">
        <div className="ct-mhd"><div><p>{eyebrow}</p><h2 id={titleId}>{title}</h2></div><button className="ct-x" type="button" onClick={onClose} disabled={busy} aria-label="Cerrar"><CloseIcon size={20} strokeWidth={2.2} /></button></div>
        {preview}
      </div>
      <form noValidate aria-label={formLabel} onSubmit={(event) => { event.preventDefault(); if (!busy) onSubmit() }}>
        <div className="ct-mbody">{children}</div>
        <div className="ct-mact">
          <button className="ct-cancel" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="ct-savec" type="submit" disabled={busy}>{busy ? <SpinnerIcon className="ct-spin" size={18} /> : <CheckIcon size={18} strokeWidth={2.6} />}{busy ? busyLabel : saveLabel}</button>
        </div>
      </form>
    </div>
  </>
}

/** Fila de formulario con etiqueta y mensaje de error. */
export function Field({ label, htmlFor, required, span, error, warn, children }: { label: string; htmlFor?: string; required?: boolean; span?: boolean; error?: string; warn?: string; children: ReactNode }) {
  const tag = htmlFor ? <label className="ct-ml" htmlFor={htmlFor}>{label}{required && <> <b>*</b></>}</label> : <p className="ct-ml">{label}{required && <> <b>*</b></>}</p>
  return <div className={`ct-mr${span ? ' ct-span2' : ''}`}>{tag}{children}{error && <span className="ct-fe">{error}</span>}{warn && <span className="ct-fe warn">{warn}</span>}</div>
}
