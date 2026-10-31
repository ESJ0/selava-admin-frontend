import { useEffect } from 'react'

const unifiedLoginURL = (import.meta.env.VITE_LOGIN_URL || 'http://localhost:5174/login').replace(/\/+$/, '')

export function LoginPage() {
  useEffect(() => { if (import.meta.env.MODE !== 'test') window.location.replace(unifiedLoginURL) }, [])
  return <main className="login-page"><section className="login-card"><div className="brand brand-login"><span className="brand-mark">✦</span><span>SELAVA</span></div><h1>Acceso unificado</h1><p>Te estamos llevando al inicio de sesión de SeLava.</p><a className="primary wide" href={unifiedLoginURL}>Continuar al login</a></section></main>
}
