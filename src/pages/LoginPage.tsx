import { useEffect, useState } from 'react'
import { SessionScreen } from '../components/admin/SessionScreen'
import { LOGOUT_FLAG } from '../utils/session'

const unifiedLoginURL = (import.meta.env.VITE_LOGIN_URL || 'http://localhost:5174/login').replace(/\/+$/, '')

function consumeLogoutFlag() {
  try {
    const value = sessionStorage.getItem(LOGOUT_FLAG) === '1'
    sessionStorage.removeItem(LOGOUT_FLAG)
    return value
  } catch { return false }
}

export function LoginPage() {
  const [loggedOut] = useState(consumeLogoutFlag)
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    const timer = window.setTimeout(() => window.location.replace(unifiedLoginURL), loggedOut ? 1400 : 900)
    return () => window.clearTimeout(timer)
  }, [loggedOut])
  return loggedOut
    ? <SessionScreen tone="out" title="Sesión cerrada" text="¡Hasta pronto! Te llevamos al inicio de sesión de SELAVA." />
    : <SessionScreen title="Acceso SELAVA" text="Te llevamos al inicio de sesión unificado.">
      <a className="ss-btn" href={unifiedLoginURL}>Continuar al inicio de sesión</a>
    </SessionScreen>
}
