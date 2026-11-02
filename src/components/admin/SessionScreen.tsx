import type { ReactNode } from 'react'

/** Pantalla de transición de sesión (iniciar / cerrar) con el logotipo de SELAVA. */
export function SessionScreen({ title, text, tone = 'in', children }: { title: string; text: string; tone?: 'in' | 'out' | 'error'; children?: ReactNode }) {
  return <main className={`ss-screen ${tone}`} aria-live="polite" aria-busy={tone !== 'error'}>
    <span className="ss-bubble b1" aria-hidden="true" /><span className="ss-bubble b2" aria-hidden="true" /><span className="ss-bubble b3" aria-hidden="true" />
    <section className="ss-card" role="status">
      <div className="ss-logo-wrap">
        {tone !== 'error' && <span className="ss-ring" aria-hidden="true" />}
        <img className="ss-logo" src="/selava-logo.png" alt="SELAVA, Lavandería y Dry Clean" width={480} height={368} />
      </div>
      <h1 className="ss-title">{title}</h1>
      <p className="ss-text">{text}</p>
      {tone !== 'error' && <div className="ss-dots" aria-hidden="true"><i /><i /><i /></div>}
      {children}
    </section>
  </main>
}
