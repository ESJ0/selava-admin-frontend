import { useCallback, useEffect, useMemo, useState } from 'react'
import { createUser, listUsers, setUserActive, updateUser, type UserAccount, type UserPayload } from '../api/users'
import { errorMessage } from '../api/client'
import { ActiveSwitch, CardFoot, CatalogHead, CatalogModal, CatalogTools, EditButton, EmptyCard, ErrorBanner, Field, LoadingCard, NewButton } from '../components/admin/CatalogKit'
import { PathIcon } from '../components/admin/icons'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../store/auth'
import { cardDelay } from '../utils/catalogLook'
import '../styles/catalogs.css'
import '../styles/reports.css'

type RoleKey = 'admin' | 'recep' | 'operario' | 'cliente'
const ROLES: Record<RoleKey, { id: number; label: string; plural: string; color: string; icon: string; desc: string }> = {
  admin: { id: 1, label: 'Administrador', plural: 'Administradores', color: '#FFC93C', icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4', desc: 'Acceso completo al panel' },
  recep: { id: 2, label: 'Recepcionista', plural: 'Recepcionistas', color: '#5BC3EC', icon: 'M4 7h16v12H4zM8 7V4h8v3M8 12h8M8 15h5', desc: 'Atiende pedidos y clientes' },
  operario: { id: 3, label: 'Operario', plural: 'Operarios', color: '#7EE0B5', icon: 'M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0', desc: 'Trabaja en la planta' },
  cliente: { id: 4, label: 'Cliente', plural: 'Clientes', color: '#C9B8FF', icon: 'M12 8a4 4 0 1 0 0-.01M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6', desc: 'Portal de clientes' },
}
const ROLE_KEYS: RoleKey[] = ['admin', 'recep', 'operario', 'cliente']
const ALL_ICON = 'M9 8a3.5 3.5 0 1 0 0-.01M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5'
const roleOf = (user: Pick<UserAccount, 'rol_id'>): RoleKey => ROLE_KEYS.find((key) => ROLES[key].id === user.rol_id) ?? 'recep'
const digits = (value: string) => value.replace(/\D/g, '')
const fmtTel = (value: string) => { const d = digits(value).slice(-8); return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d }
const initials = (nombre: string, apellido: string) => `${nombre.trim()[0] ?? ''}${apellido.trim()[0] ?? ''}`.toUpperCase()
const fullName = (user: Pick<UserAccount, 'nombre' | 'apellido' | 'email'>) => `${user.nombre ?? ''} ${user.apellido ?? ''}`.trim() || user.email

/** Identidad de la sesión actual tomada del token (si el token la incluye). */
function sessionIdentity(token: string | null) {
  try {
    const payload = JSON.parse(atob((token ?? '').split('.')[1])) as Record<string, unknown>
    const raw = payload.usuario_id ?? payload.user_id ?? payload.id ?? payload.sub
    const id = Number(raw)
    return { id: Number.isInteger(id) && id > 0 ? id : null, email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null }
  } catch { return { id: null, email: null } }
}

export function UsersPage() {
  const token = useAuth((state) => state.token)
  const me = useMemo(() => sessionIdentity(token), [token])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState<RoleKey | 'all'>('all')
  const [tab, setTab] = useState(0)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<UserAccount | null | undefined>()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [freshId, setFreshId] = useState(0)
  const toast = useToast(2400)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setUsers((await listUsers()) ?? []) } catch (cause) { setError(errorMessage(cause)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  async function toggle(user: UserAccount) {
    if (busyId != null) return
    setBusyId(user.id)
    try {
      await setUserActive(user.id, !user.activo)
      setUsers((list) => list.map((entry) => entry.id === user.id ? { ...entry, activo: !user.activo } : entry))
      toast.show(`${fullName(user)} ${user.activo ? 'desactivado' : 'activado'}`)
    } catch (cause) {
      toast.show(errorMessage(cause), true)
    } finally {
      setBusyId(null)
    }
  }

  const isMe = (user: UserAccount) => (me.id != null && user.id === me.id) || (!!me.email && user.email.toLowerCase() === me.email)
  const nameCount = useMemo(() => { const counts = new Map<string, number>(); users.forEach((user) => { const key = `${user.nombre} ${user.apellido}`.trim().toLowerCase(); if (key) counts.set(key, (counts.get(key) ?? 0) + 1) }); return counts }, [users])
  const q = query.trim().toLowerCase()
  const list = users
    .filter((user) => role === 'all' || roleOf(user) === role)
    .filter((user) => tab === 0 || (tab === 1 ? user.activo : !user.activo))
    .filter((user) => !q || `${user.nombre} ${user.apellido} ${user.email} ${user.telefono ?? ''}`.toLowerCase().includes(q))
  const chips = [{ key: 'all' as const, label: 'Todos', color: '#0E9BD6', icon: ALL_ICON, n: users.length }, ...ROLE_KEYS.map((key) => ({ key, label: ROLES[key].plural, color: ROLES[key].color, icon: ROLES[key].icon, n: users.filter((user) => roleOf(user) === key).length }))]

  return <section className="ct-page">
    <CatalogHead eyebrow="Administración" title="Usuarios" sub="Administra cuentas, roles y acceso a SeLava."><NewButton label="Nuevo usuario" onClick={() => setEditing(null)} /></CatalogHead>
    <section className="us-roles ad-st" style={{ animationDelay: '.18s' }} role="group" aria-label="Filtrar por rol">
      {chips.map((chip) => <button key={chip.key} type="button" className="us-rch" aria-pressed={role === chip.key} onClick={() => setRole(chip.key)} style={{ '--rc': chip.color } as React.CSSProperties}>
        <span className="us-rci"><PathIcon d={chip.icon} size={20} /></span><span><b>{chip.n}</b><small>{chip.label}</small></span>
      </button>)}
    </section>
    <CatalogTools query={query} onQuery={setQuery} placeholder="Buscar por nombre, correo o teléfono…" tabs={['Todos', 'Activos', 'Inactivos']} tab={tab} onTab={setTab} />
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    <section className="ct-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
      {loading ? <LoadingCard text="Cargando usuarios…" />
        : error ? null
        : list.length === 0 ? <EmptyCard title={users.length ? 'Sin usuarios' : 'Aún no hay usuarios'} text={users.length ? 'Prueba otro filtro o búsqueda.' : 'Crea la primera cuenta para comenzar.'} />
        : list.map((user, index) => {
          const r = ROLES[roleOf(user)]
          const mine = isMe(user)
          const name = fullName(user)
          return <article key={user.id} className={`ct-card${user.activo ? '' : ' off'}${user.id === freshId ? ' fresh' : ''}`} style={{ animationDelay: cardDelay(index, 0.04) }} aria-label={name}>
            <div className="ct-dim us-badge">
              <div className="us-band" style={{ background: r.color }}><span className="us-slot" aria-hidden="true" /><span className="us-rlab">{user.rol || r.label}</span></div>
              <div style={{ padding: '0 20px 16px', textAlign: 'center' }}>
                <span className="us-uav" style={{ background: '#0A2433', color: r.color }}>{initials(user.nombre ?? '', user.apellido ?? '') || user.email[0]?.toUpperCase()}</span>
                <p className="ct-name" style={{ margin: '12px 0 2px', fontSize: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{name}{mine && <span className="us-meb">Tú</span>}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#5A7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600 }}>{user.telefono ? `+502 ${fmtTel(user.telefono)}` : 'Sin teléfono'}</p>
                {(nameCount.get(`${user.nombre} ${user.apellido}`.trim().toLowerCase()) ?? 0) > 1 && <span className="ct-dupb" style={{ marginTop: 8 }}>Mismo nombre que otra cuenta</span>}
              </div>
            </div>
            <CardFoot>
              {mine ? <span style={{ fontSize: 13, color: '#5A7280' }}>Tu sesión actual</span> : <ActiveSwitch active={user.activo} name={name} busy={busyId === user.id} onToggle={() => void toggle(user)} />}
              <EditButton name={name} onClick={() => setEditing(user)} />
            </CardFoot>
          </article>
        })}
    </section>
    {editing !== undefined && <UserForm item={editing} users={users} onClose={() => setEditing(undefined)} onSaved={(id, created) => {
      setEditing(undefined); setFreshId(id); setTab(0); setRole('all'); toast.show(created ? 'Usuario creado' : 'Cambios guardados'); void load()
    }} />}
    {toast.node}
  </section>
}

function passwordScore(value: string) {
  let score = 0
  if (value.length >= 8) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  if (value && value.length < 8) score = Math.min(score, 1)
  return score
}
const SCORE_COLORS = ['#E07A1F', '#FFC93C', '#0E9BD6', '#1F8A5B']

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#$%'
  const random = new Uint32Array(10)
  crypto.getRandomValues(random)
  return `Sl${Array.from(random, (n) => chars[n % chars.length]).join('')}7#`
}

export function UserForm({ item, users, onClose, onSaved }: { item: UserAccount | null; users: UserAccount[]; onClose: () => void; onSaved: (id: number, created: boolean) => void }) {
  const isNew = !item
  const [f, setF] = useState({ role: (item ? roleOf(item) : '') as RoleKey | '', nombre: item?.nombre ?? '', apellido: item?.apellido ?? '', email: item?.email ?? '', tel: item?.telefono ? fmtTel(item.telefono) : '', pass: '', direccion: '' })
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const set = (patch: Partial<typeof f>) => setF((current) => ({ ...current, ...patch }))

  const email = f.email.trim().toLowerCase()
  const tel = digits(f.tel)
  const dupEmail = !!email && users.some((user) => user.id !== item?.id && user.email.toLowerCase() === email)
  const telRequired = isNew ? f.role !== 'admin' : !!item?.telefono
  const valid = {
    role: !isNew || !!f.role,
    nombre: !!f.nombre.trim(),
    apellido: !!f.apellido.trim(),
    email: /^\S+@\S+\.\S+$/.test(email) && !dupEmail,
    tel: tel.length === 8 || (!telRequired && tel.length === 0),
    pass: !isNew || (f.pass.length >= 8 && new TextEncoder().encode(f.pass).length <= 72),
  }
  const er = Object.fromEntries(Object.entries(valid).map(([key, ok]) => [key, touched && !ok])) as Record<keyof typeof valid, boolean>
  if (dupEmail) er.email = true
  const score = passwordScore(f.pass)
  const r = f.role ? ROLES[f.role] : null
  const ini = initials(f.nombre, f.apellido) || '?'

  async function save() {
    setTouched(true)
    if (!Object.values(valid).every(Boolean)) return
    const payload: UserPayload = isNew
      ? { rol_id: ROLES[f.role as RoleKey].id, email, password: f.pass, nombre: f.nombre.trim(), apellido: f.apellido.trim(), telefono: tel, ...(f.role === 'cliente' && f.direccion.trim() ? { direccion: f.direccion.trim() } : {}) }
      : { nombre: f.nombre.trim(), apellido: f.apellido.trim(), email, ...(tel ? { telefono: tel } : {}) }
    setSaving(true)
    setServerError('')
    try {
      const saved = isNew ? await createUser(payload) : await updateUser(item.id, payload)
      onSaved(saved?.id ?? item?.id ?? 0, isNew)
    } catch (cause) {
      setServerError(errorMessage(cause))
      setSaving(false)
    }
  }

  const preview = <div className="us-pvb">
    <span className="us-lany" aria-hidden="true" />
    <div className="us-badge us-pvbadge">
      <div className="us-band" style={{ background: r?.color ?? '#DCE7EC' }}><span className="us-slot" aria-hidden="true" /><span className="us-rlab">{r?.label ?? 'Sin rol'}</span></div>
      <div style={{ padding: '0 18px 16px', textAlign: 'center', color: '#0A2433' }}>
        <span className="us-uav" style={{ background: r?.color ?? '#DCE7EC', color: '#0A2433' }}>{ini}</span>
        <p className="ct-name" style={{ margin: '10px 0 2px', fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{`${f.nombre.trim()} ${f.apellido.trim()}`.trim() || 'Nombre del usuario'}</p>
        <p style={{ margin: 0, fontSize: 13, color: '#5A7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email.trim() || 'correo@selava.local'}</p>
      </div>
    </div>
  </div>

  return <CatalogModal eyebrow={isNew ? 'NUEVO' : 'EDITAR'} title={isNew ? 'Nuevo usuario' : 'Editar usuario'} width={680} preview={preview} busy={saving} onClose={onClose} onSubmit={() => void save()} saveLabel={isNew ? 'Crear usuario' : 'Guardar cambios'}>
    {isNew && <Field label="Tipo de usuario" required span error={er.role ? 'Elige un tipo de usuario.' : ''}>
      <div className="us-rpick" role="radiogroup" aria-label="Tipo de usuario">
        {(['admin', 'recep', 'cliente'] as RoleKey[]).map((key) => <button key={key} type="button" role="radio" aria-checked={f.role === key} className="us-rp" style={{ '--rc': ROLES[key].color } as React.CSSProperties} onClick={() => set({ role: key })}>
          <span className="us-rci"><PathIcon d={ROLES[key].icon} size={20} /></span><b>{ROLES[key].label}</b><small>{ROLES[key].desc}</small>
        </button>)}
      </div>
    </Field>}
    <Field label="Nombre" htmlFor="us-f-n" required error={er.nombre ? 'Escribe el nombre.' : ''}>
      <input className={`ct-mi${er.nombre ? ' bad' : ''}`} id="us-f-n" type="text" autoComplete="off" maxLength={100} value={f.nombre} onChange={(event) => set({ nombre: event.target.value })} />
    </Field>
    <Field label="Apellido" htmlFor="us-f-a" required error={er.apellido ? 'Escribe el apellido.' : ''}>
      <input className={`ct-mi${er.apellido ? ' bad' : ''}`} id="us-f-a" type="text" autoComplete="off" maxLength={100} value={f.apellido} onChange={(event) => set({ apellido: event.target.value })} />
    </Field>
    <Field label="Correo electrónico" htmlFor="us-f-e" required span error={er.email ? (dupEmail ? 'Ya existe una cuenta con ese correo.' : 'Revisa el formato del correo.') : ''}>
      <input className={`ct-mi${er.email ? ' bad' : ''}`} id="us-f-e" type="email" autoComplete="off" value={f.email} onChange={(event) => set({ email: event.target.value })} />
    </Field>
    <Field label="Teléfono" htmlFor="us-f-t" required={telRequired} span error={er.tel ? 'Usa 8 dígitos.' : ''}>
      <div className={`ct-pfx${er.tel ? ' bad' : ''}`}><span style={{ fontSize: 15 }}>+502</span><input id="us-f-t" type="tel" inputMode="numeric" placeholder="5555-1234" value={f.tel} style={{ fontSize: 18 }} onChange={(event) => set({ tel: fmtTel(digits(event.target.value).slice(0, 8)) })} /></div>
    </Field>
    {isNew && f.role === 'cliente' && <Field label="Dirección" htmlFor="us-f-d" span>
      <input className="ct-mi" id="us-f-d" type="text" placeholder="Opcional" value={f.direccion} onChange={(event) => set({ direccion: event.target.value })} />
    </Field>}
    {isNew && <Field label="Contraseña" htmlFor="us-f-p" required span error={er.pass ? 'Mínimo 8 caracteres.' : ''}>
      <div className="us-pw">
        <input className={`ct-mi${er.pass ? ' bad' : ''}`} id="us-f-p" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={f.pass} onChange={(event) => set({ pass: event.target.value })} />
        <button className="us-eye" type="button" aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPw(!showPw)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12C3.5 10.5 7 6 12 6s8.5 4.5 9.5 6c-1 1.5-4.5 6-9.5 6s-8.5-4.5-9.5-6z" /><circle cx="12" cy="12" r="3" />{showPw && <path d="M4 4l16 16" />}</svg></button>
        <button className="us-gen" type="button" onClick={() => { set({ pass: generatePassword() }); setShowPw(true) }}>Generar</button>
      </div>
      <div className="us-segs" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} style={{ background: i < score ? SCORE_COLORS[score - 1] : '#DCE7EC' }} />)}</div>
      <span className="ct-hint">{f.pass ? `${['Débil', 'Débil', 'Regular', 'Buena', 'Excelente'][score]} · mínimo 8 caracteres, admite hasta 72 bytes` : 'Mínimo 8 caracteres, admite hasta 72 bytes'}</span>
    </Field>}
    {serverError && <div className="ct-merr" role="alert">{serverError}</div>}
  </CatalogModal>
}
