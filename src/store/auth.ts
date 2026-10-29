import { create } from 'zustand'

interface AuthState { token: string | null; roleId: number | null; role: string | null; setToken: (token: string) => void; logout: () => void }
export function tokenIdentity(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { rol_id?: number; rol?: string; exp?: number }
    if (!payload.exp || payload.exp * 1000 <= Date.now()) return null
    if (![1, 2, 3].includes(payload.rol_id ?? 0)) return null
    return { roleId: payload.rol_id!, role: payload.rol ?? null, expiresAt: payload.exp * 1000 }
  } catch { return null }
}
let expirationTimer: number | undefined
function scheduleLogout(expiresAt: number, logout: () => void) {
  if (expirationTimer) window.clearTimeout(expirationTimer)
  expirationTimer = window.setTimeout(logout, Math.min(expiresAt - Date.now(), 2_147_483_647))
}
const storedToken = sessionStorage.getItem('selava_token')
const initialIdentity = storedToken ? tokenIdentity(storedToken) : null
const initialToken = initialIdentity ? storedToken : null
if (!initialToken) sessionStorage.removeItem('selava_token')
export const useAuth = create<AuthState>((set) => ({
  token: initialToken, roleId: initialIdentity?.roleId ?? null, role: initialIdentity?.role ?? null,
  setToken: (token) => {
    const identity = tokenIdentity(token)
    if (!identity) { sessionStorage.removeItem('selava_token'); set({ token: null, roleId: null, role: null }); return }
    sessionStorage.setItem('selava_token', token)
    scheduleLogout(identity.expiresAt, () => useAuth.getState().logout())
    set({ token, roleId: identity.roleId, role: identity.role })
  },
  logout: () => { if (expirationTimer) window.clearTimeout(expirationTimer); sessionStorage.removeItem('selava_token'); set({ token: null, roleId: null, role: null }) },
}))
if (initialIdentity) scheduleLogout(initialIdentity.expiresAt, () => useAuth.getState().logout())
