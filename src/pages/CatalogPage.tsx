import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createCatalog, deactivateCatalog, listCatalog, updateCatalog, type CatalogEntity, type CatalogPayload } from '../api/catalogs'
import { errorMessage } from '../api/client'
import { ActiveSwitch, CardFoot, CatalogHead, CatalogModal, CatalogTools, EditButton, EmptyCard, ErrorBanner, Field, LoadingCard, NewButton } from '../components/admin/CatalogKit'
import { PathIcon } from '../components/admin/icons'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../store/auth'
import type { CatalogKind, ModalidadCobro, Servicio, TipoPrenda } from '../types'
import { cardDelay, clockPct, filterByTab, garmentIcon, MODE_KEYS, MODES, modeOf, onlyDecimal, parseNum, paymentLook, serviceEta, serviceIcon } from '../utils/catalogLook'
import '../styles/catalogs.css'

const config = {
  servicios: { title: 'Servicios', sub: 'Gestiona los servicios que ofrece SeLava.', button: 'Nuevo servicio', search: 'Buscar servicio…', emptyTitle: 'Sin servicios', emptyText: 'Cambia el filtro o crea un servicio nuevo.' },
  'tipos-prenda': { title: 'Tipos de prenda', sub: 'Gestiona los tipos de prenda y sus precios en quetzales.', button: 'Nuevo tipo', search: 'Buscar tipo de prenda…', emptyTitle: 'Sin resultados', emptyText: 'Prueba con otro nombre o cambia el filtro.' },
  'metodos-pago': { title: 'Métodos de pago', sub: 'Gestiona los métodos de pago aceptados.', button: 'Nuevo método', search: 'Buscar método…', emptyTitle: 'Sin métodos', emptyText: 'Cambia el filtro o agrega un método nuevo.' },
} satisfies Record<CatalogKind, Record<string, string>>

const PAYMENT_SUGGESTIONS = ['Pago móvil', 'Depósito bancario', 'Código QR', 'Cheque']
const MAX_PRICE = 99999999.99
const descOf = (item: CatalogEntity) => (item as TipoPrenda | Servicio).descripcion ?? ''

export function CatalogPage({ kind }: { kind: CatalogKind }) {
  return <CatalogView key={kind} kind={kind} />
}

function CatalogView({ kind }: { kind: CatalogKind }) {
  const meta = config[kind]
  const isAdmin = useAuth((state) => state.roleId) === 1
  const [items, setItems] = useState<CatalogEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<CatalogEntity | null | undefined>()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [freshId, setFreshId] = useState(0)
  const toast = useToast(2400)
  const version = useRef(0)

  const load = useCallback(async () => {
    const current = ++version.current
    setLoading(true)
    setError('')
    try {
      const response = await listCatalog(kind)
      if (current === version.current) setItems(response ?? [])
    } catch (cause) {
      if (current === version.current) { setItems([]); setError(errorMessage(cause)) }
    } finally {
      if (current === version.current) setLoading(false)
    }
  }, [kind])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function toggle(item: CatalogEntity) {
    if (busyId != null) return
    setBusyId(item.id)
    try {
      if (item.activo) await deactivateCatalog(kind, item.id)
      else await updateCatalog(kind, item.id, { activo: true })
      setItems((list) => list.map((entry) => entry.id === item.id ? { ...entry, activo: !item.activo } : entry))
      toast.show(`${item.nombre} ${item.activo ? 'desactivado' : 'activado'}`)
    } catch (cause) {
      toast.show(errorMessage(cause), true)
    } finally {
      setBusyId(null)
    }
  }

  const list = useMemo(() => filterByTab(items, tab, query, (item) => `${item.nombre} ${descOf(item)}`), [items, tab, query])
  const edit = isAdmin ? (item: CatalogEntity) => setEditing(item) : undefined

  return <section className="ct-page">
    <CatalogHead title={meta.title} sub={meta.sub}>{isAdmin && <NewButton label={meta.button} onClick={() => setEditing(null)} />}</CatalogHead>
    <Stats kind={kind} items={items} />
    <CatalogTools query={query} onQuery={setQuery} placeholder={meta.search} tabs={['Todos', 'Activos', 'Inactivos']} tab={tab} onTab={setTab} />
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    <section className="ct-grid">
      {loading && !items.length ? <LoadingCard text={`Cargando ${meta.title.toLowerCase()}…`} />
        : error ? null
        : list.length === 0 ? <EmptyCard title={items.length ? meta.emptyTitle : `Aún no hay ${meta.title.toLowerCase()}`} text={items.length ? meta.emptyText : isAdmin ? 'Crea el primer registro para comenzar.' : 'Todavía no se han registrado.'} />
        : list.map((item, index) => {
          const cls = `ct-card${item.activo ? '' : ' off'}${item.id === freshId ? ' fresh' : ''}`
          const style = { animationDelay: cardDelay(index, kind === 'tipos-prenda' ? 0.04 : 0.05) }
          const foot = <CardFoot>
            <ActiveSwitch active={item.activo} name={item.nombre} busy={busyId === item.id} onToggle={isAdmin ? () => void toggle(item) : undefined} />
            {edit && <EditButton name={item.nombre} onClick={() => edit(item)} />}
          </CardFoot>
          return <article key={item.id} className={cls} style={style}>
            {kind === 'tipos-prenda' ? <GarmentBody item={item as TipoPrenda} onPending={edit && (() => edit(item))} />
              : kind === 'servicios' ? <ServiceBody item={item as Servicio} />
              : <PaymentBody name={item.nombre} active={item.activo} />}
            {foot}
          </article>
        })}
    </section>
    {editing !== undefined && <CatalogForm kind={kind} item={editing} items={items} onClose={() => setEditing(undefined)} onSaved={(id, message) => {
      setEditing(undefined); setFreshId(id); setTab(0); toast.show(message); void load()
    }} />}
    {toast.node}
  </section>
}

function Stats({ kind, items }: { kind: CatalogKind; items: CatalogEntity[] }) {
  const active = items.filter((item) => item.activo)
  const style = { animationDelay: '.18s' }
  if (kind === 'tipos-prenda') {
    const types = items as TipoPrenda[]
    const priced = types.filter((item) => item.activo && item.precio)
    const avg = priced.length ? `Q${(priced.reduce((sum, item) => sum + (item.precio ?? 0), 0) / priced.length).toFixed(0)}` : '—'
    const modes = MODE_KEYS.filter((mode) => types.some((item) => item.activo && modeOf(item.modalidad_cobro) === mode)).map((mode) => MODES[mode].label.replace('Por ', '')).join(' · ')
    return <section className="ct-stats ad-st" style={style}>
      <div className="dark"><p className="k">Tipos activos</p><p className="v">{active.length}</p></div>
      <div className="warn"><p className="k">Pendientes de precio</p><p className="v" style={{ color: '#9A6A00' }}>{types.filter((item) => !item.precio).length}</p></div>
      <div><p className="k">Precio promedio</p><p className="v">{avg}</p></div>
      <div><p className="k">Modalidades en uso</p><p className="v xs">{modes || '—'}</p></div>
    </section>
  }
  if (kind === 'servicios') {
    const timed = (active as Servicio[]).filter((item) => item.tiempo_estimado_horas)
    const fast = timed.slice().sort((a, b) => (a.tiempo_estimado_horas ?? 0) - (b.tiempo_estimado_horas ?? 0))[0]
    return <section className="ct-stats ad-st" style={style}>
      <div className="dark"><p className="k">Servicios activos</p><p className="v">{active.length}</p></div>
      <div><p className="k">Inactivos</p><p className="v" style={{ color: '#5A7280' }}>{items.length - active.length}</p></div>
      <div><p className="k">Tiempo promedio</p><p className="v">{timed.length ? `${Math.round(timed.reduce((sum, item) => sum + (item.tiempo_estimado_horas ?? 0), 0) / timed.length)} h` : '—'}</p></div>
      <div><p className="k">Más rápido</p><p className="v sm">{fast ? `${fast.nombre} · ${fast.tiempo_estimado_horas} h` : '—'}</p></div>
    </section>
  }
  return <section className="ct-stats three ad-st" style={style}>
    <div className="dark"><p className="k">Aceptados en caja</p><p className="v">{active.length}</p></div>
    <div><p className="k">Inactivos</p><p className="v" style={{ color: '#5A7280' }}>{items.length - active.length}</p></div>
    <div><p className="k">Total registrados</p><p className="v">{items.length}</p></div>
  </section>
}

function GarmentBody({ item, onPending }: { item: TipoPrenda; onPending?: () => void }) {
  const mode = modeOf(item.modalidad_cobro)
  const pending = <><PathIcon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v6M12 16.5v.5" size={16} strokeWidth={2.2} />Pendiente de configurar precio</>
  return <div className="ct-dim ct-tagw">
    <div className="ct-tag">
      <span className="ct-hole" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <span className="ct-gi"><PathIcon d={garmentIcon(item.nombre, mode)} size={24} /></span>
        <span className="ct-modeb">{MODES[mode].label}</span>
      </div>
      <p className="ct-name" style={{ margin: '16px 0 2px', fontSize: 24 }}>{item.nombre}</p>
      <p className="ct-desc" style={{ minHeight: 20 }}>{item.descripcion || 'Sin descripción'}</p>
      <div className="ct-pricebox">
        {item.precio ? <p className="ct-price"><span>Q</span>{item.precio.toFixed(2)}<span>{MODES[mode].per}</span></p>
          : onPending ? <button className="ct-pend" type="button" onClick={onPending}>{pending}</button>
          : <span className="ct-pend">{pending}</span>}
      </div>
    </div>
  </div>
}

function ServiceBody({ item }: { item: Servicio }) {
  const hours = item.tiempo_estimado_horas
  return <>
    <div className="ct-dim" style={{ padding: '20px 20px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
      <div className="ct-clock" style={{ '--p': clockPct(hours) } as CSSProperties}>
        <span className="ct-cin"><b>{hours ?? '—'}</b><small>HORAS</small></span>
        <span className="ct-hand" />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span className="ct-si"><PathIcon d={serviceIcon(item.nombre)} size={20} /></span>
        <p className="ct-name" style={{ margin: '10px 0 2px', fontSize: 22, lineHeight: 1.1 }}>{item.nombre}</p>
        <p className="ct-desc">{item.descripcion || 'Sin descripción'}</p>
      </div>
    </div>
    <div className="ct-dim" style={{ padding: '0 20px 14px' }}><span className="ct-eta">{serviceEta(hours)}</span></div>
  </>
}

function PaymentCard({ name, active = true, floating }: { name: string; active?: boolean; floating?: boolean }) {
  const look = paymentLook(name)
  return <div className={`ct-pcard${floating ? ' flt' : ''}`} style={{ background: active ? look.bg : '#9DB3BE', color: active ? look.fg : '#fff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><span className="ct-chipc" /><span className="ct-mic"><PathIcon d={look.icon} size={24} /></span></div>
    <p className="ct-name" style={floating ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}>{name}</p>
    <p className="ct-pkind">{look.kind}</p>
  </div>
}

function PaymentBody({ name, active }: { name: string; active: boolean }) {
  return <div className="ct-dim" style={{ padding: 16 }}><PaymentCard name={name} active={active} /></div>
}

type FormValues = { name: string; desc: string; mode: ModalidadCobro; price: string; hours: string }

function CatalogForm({ kind, item, items, onClose, onSaved }: { kind: CatalogKind; item: CatalogEntity | null; items: CatalogEntity[]; onClose: () => void; onSaved: (id: number, message: string) => void }) {
  const type = item as TipoPrenda | null
  const service = item as Servicio | null
  const [f, setF] = useState<FormValues>(() => ({
    name: item?.nombre ?? '',
    desc: item ? descOf(item) : '',
    mode: modeOf(type?.modalidad_cobro),
    price: type?.precio ? String(type.precio) : '',
    hours: item ? (service?.tiempo_estimado_horas ? String(service.tiempo_estimado_horas) : '') : '24',
  }))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const set = (patch: Partial<FormValues>) => setF((current) => ({ ...current, ...patch }))

  const name = f.name.trim()
  const price = parseNum(f.price)
  const hours = f.hours ? Number(f.hours) : Number.NaN
  const dup = kind === 'metodos-pago' && !!name && items.some((entry) => entry.id !== item?.id && entry.nombre.toLowerCase() === name.toLowerCase())
  const priceProblem = kind !== 'tipos-prenda' ? ''
    : !(price > 0) ? 'Escribe un precio mayor que cero.'
    : price > MAX_PRICE ? 'El precio no puede superar Q99,999,999.99.'
    : !/^\d+(?:[.,]\d{1,2})?$/.test(f.price.trim()) ? 'Usa como máximo dos decimales.' : ''
  const hoursProblem = kind === 'servicios' && f.hours && !(Number.isInteger(hours) && hours >= 1) ? 'Escribe horas mayores que cero.' : ''
  const er = { name: touched && !name ? 'Escribe un nombre.' : '', price: touched ? priceProblem : '', hours: touched ? hoursProblem : '' }

  const singular = kind === 'tipos-prenda' ? 'tipo de prenda' : kind === 'servicios' ? 'servicio' : 'método de pago'
  const saveLabel = `Guardar ${singular}`
  const title = `${item ? 'Editar' : 'Nuevo'} ${singular}`

  async function save() {
    setTouched(true)
    if (!name || priceProblem || hoursProblem || dup) return
    const payload: CatalogPayload = { nombre: name }
    if (kind !== 'metodos-pago') payload.descripcion = f.desc.trim()
    if (kind === 'tipos-prenda') { payload.precio = Math.round(price * 100) / 100; payload.modalidad_cobro = f.mode }
    if (kind === 'servicios' && f.hours) payload.tiempo_estimado_horas = hours
    setSaving(true)
    setServerError('')
    try {
      const saved = item ? await updateCatalog(kind, item.id, payload) : await createCatalog(kind, payload)
      const label = kind === 'tipos-prenda' ? 'Tipo de prenda' : kind === 'servicios' ? 'Servicio' : item ? 'Método' : 'Método de pago'
      onSaved(saved?.id ?? item?.id ?? 0, `${label} ${item ? 'actualizado' : 'creado'}`)
    } catch (cause) {
      setServerError(errorMessage(cause))
      setSaving(false)
    }
  }

  const hn = Math.max(1, Math.min(72, Number.isFinite(hours) ? hours : 1))
  const preview = kind === 'tipos-prenda'
    ? <div className="ct-pv"><span className="ct-pvstring" /><div className="ct-pvtag">
      <span className="ct-hole" />
      <span className="ct-gi"><PathIcon d={garmentIcon(f.name, f.mode)} size={24} /></span>
      <p className="ct-name" style={{ margin: '12px 0 0', fontSize: 22, color: '#0A2433', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Nombre del tipo'}</p>
      <p className="ct-name" style={{ margin: '6px 0 0', fontSize: 30, letterSpacing: '-.03em', color: '#06709F' }}>{price > 0 ? `Q${price.toFixed(2)}` : 'Q —'} <span style={{ fontSize: 13, fontWeight: 600, color: '#5A7280', letterSpacing: 0 }}>{MODES[f.mode].per}</span></p>
    </div></div>
    : kind === 'servicios'
      ? <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="ct-clock big" style={{ '--p': clockPct(Number.isFinite(hours) ? hours : 0) } as CSSProperties}><span className="ct-cin dark"><b>{Number.isFinite(hours) ? hours : '—'}</b><small>HORAS</small></span><span className="ct-hand" /></div>
        <div style={{ minWidth: 0 }}>
          <p className="ct-name" style={{ fontSize: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Nombre del servicio'}</p>
          <p style={{ margin: '4px 0 0', color: '#A9C1CD', fontSize: 14 }}>{f.desc.trim() || 'Sin descripción'}</p>
          <p style={{ margin: '8px 0 0', color: '#5BC3EC', fontSize: 14, fontWeight: 600 }}>{serviceEta(Number.isFinite(hours) ? hours : undefined)}</p>
        </div>
      </div>
      : <PaymentCard name={name || 'Nombre del método'} floating />

  const maxName = kind === 'tipos-prenda' ? 50 : 100
  return <CatalogModal eyebrow={item ? 'EDITAR' : 'NUEVO'} title={title} width={kind === 'metodos-pago' ? 540 : undefined} preview={preview} busy={saving} onClose={onClose} onSubmit={() => void save()} saveLabel={saveLabel}>
    <Field label="Nombre" htmlFor="ct-f-name" required span error={er.name} warn={dup ? 'Ya existe un método con ese nombre.' : undefined}>
      <input className={`ct-mi${er.name ? ' bad' : ''}`} id="ct-f-name" type="text" autoFocus maxLength={maxName} placeholder={kind === 'tipos-prenda' ? 'Ej. Chaqueta' : kind === 'servicios' ? 'Ej. Desmanchado' : 'Ej. Pago móvil'} value={f.name} onChange={(event) => set({ name: event.target.value })} />
      {kind === 'metodos-pago' && <div className="ct-opts" style={{ marginTop: 10 }}>
        {PAYMENT_SUGGESTIONS.filter((label) => !items.some((entry) => entry.nombre.toLowerCase() === label.toLowerCase())).map((label) => <button key={label} type="button" className="ct-opt" onClick={() => set({ name: label })}>{label}</button>)}
      </div>}
    </Field>
    {kind !== 'metodos-pago' && <Field label="Descripción" htmlFor="ct-f-desc" span>
      <textarea className="ct-mi" id="ct-f-desc" rows={2} placeholder="Opcional" maxLength={kind === 'tipos-prenda' ? 255 : 500} value={f.desc} onChange={(event) => set({ desc: event.target.value })} />
    </Field>}
    {kind === 'tipos-prenda' && <>
      <Field label="Modalidad de cobro" required span>
        <div className="ct-opts" role="radiogroup" aria-label="Modalidad de cobro">
          {MODE_KEYS.map((mode) => <button key={mode} type="button" role="radio" aria-checked={f.mode === mode} className="ct-opt" onClick={() => set({ mode })}>
            <PathIcon d={MODES[mode].icon} size={18} />{MODES[mode].label} <small>{MODES[mode].ex}</small>
          </button>)}
        </div>
      </Field>
      <Field label="Precio por medida" htmlFor="ct-f-price" required span error={er.price}>
        <div className={`ct-pfx${er.price ? ' bad' : ''}`}><span>Q</span><input id="ct-f-price" type="text" inputMode="decimal" placeholder="0.00" value={f.price} onChange={(event) => set({ price: onlyDecimal(event.target.value) })} /><em>{MODES[f.mode].per}</em></div>
      </Field>
    </>}
    {kind === 'servicios' && <Field label="Tiempo estimado" htmlFor="ct-f-hours" span error={er.hours}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <input className="ct-rng" id="ct-f-hours" type="range" min={1} max={72} value={hn} onChange={(event) => set({ hours: event.target.value })} style={{ '--v': `${Math.round((hn - 1) / 71 * 100)}%` } as CSSProperties} />
        <div className={`ct-pfx${er.hours ? ' bad' : ''}`} style={{ width: 130, flex: 'none' }}><input type="text" inputMode="numeric" aria-label="Horas" value={f.hours} onChange={(event) => set({ hours: event.target.value.replace(/\D/g, '').slice(0, 3) })} /><em>h</em></div>
      </div>
      <div className="ct-opts" style={{ marginTop: 10 }}>
        {[2, 12, 24, 48, 72].map((value) => <button key={value} type="button" className={`ct-opt${hours === value ? ' on' : ''}`} aria-pressed={hours === value} onClick={() => set({ hours: String(value) })}>{value} h</button>)}
      </div>
    </Field>}
    {serverError && <div className="ct-merr" role="alert">{serverError}</div>}
  </CatalogModal>
}
