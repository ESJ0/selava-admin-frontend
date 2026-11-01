import { useEffect, useMemo, useState } from 'react'
import { listPromotions, savePromotion, setPromotionActive } from '../api/promotions'
import { listGarmentTypes } from '../api/orders'
import { errorMessage } from '../api/client'
import { CatalogHead, CatalogModal, CatalogTools, ErrorBanner, Field, LoadingCard, NewButton } from '../components/admin/CatalogKit'
import { PathIcon } from '../components/admin/icons'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../store/auth'
import type { TipoPrenda } from '../types'
import type { Promotion, PromotionPayload } from '../types/promotion'
import { MODES, modeOf, onlyDecimal, parseNum } from '../utils/catalogLook'
import '../styles/catalogs.css'

const MAX_PRICE = 99999999.99
const MAX_MEASURE = 99999999.999
const money = (value: number) => `Q${value.toFixed(2)}`
const plain = (value: number) => value % 1 ? value.toFixed(2) : String(value)
const measure = (value: number) => String(Math.round(value * 1000) / 1000)
const qtyText = (value: number, mode: string) => `${measure(value)} ${MODES[modeOf(mode)].short}`
const shortDate = (value: string) => { const date = new Date(value); return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` }

const localDateTime = (value?: string | Date) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function defaultRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(start.getFullYear(), start.getMonth() + 2, 0, 23, 59)
  return { start: localDateTime(start), end: localDateTime(end) }
}

/** Estado de vigencia: [etiqueta, fondo, texto]. */
function validity(item: Promotion, now = Date.now()): [string, string, string] {
  if (!item.activo) return ['Inactiva', '#EEF3F6', '#5A7280']
  if (now < Date.parse(item.fecha_inicio)) return ['Programada', '#E3EEFF', '#3D6FD9']
  if (now > Date.parse(item.fecha_fin)) return ['Vencida', '#FDEDE6', '#C8401F']
  return ['Vigente', '#E2F6EC', '#1F8A5B']
}

const dupKey = (item: Promotion) => [item.nombre.trim().toLowerCase(), item.tipo_prenda_id, item.medida_requerida, item.precio_promocional].join('|')

export function PromotionForm({ item, types, onClose, onSaved }: { item: Promotion | null; types: TipoPrenda[]; onClose: () => void; onSaved: (saved?: Promotion) => void }) {
  const [f, setF] = useState(() => {
    const range = defaultRange()
    return {
      typeId: item?.tipo_prenda_id ?? 0,
      qty: item ? measure(item.medida_requerida) : '',
      price: item ? String(item.precio_promocional) : '',
      name: item?.nombre ?? '',
      desc: item?.descripcion ?? '',
      start: item ? localDateTime(item.fecha_inicio) : range.start,
      end: item ? localDateTime(item.fecha_fin) : range.end,
      active: item?.activo ?? true,
    }
  })
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const set = (patch: Partial<typeof f>) => setF((current) => ({ ...current, ...patch }))

  const options = types.filter((type) => type.activo || type.id === f.typeId)
  const type = types.find((entry) => entry.id === f.typeId)
  const mode = modeOf(type?.modalidad_cobro ?? item?.modalidad_cobro)
  const qty = parseNum(f.qty)
  const price = parseNum(f.price)
  const start = new Date(f.start)
  const end = new Date(f.end)

  const problems = {
    type: !type ? 'Elige un tipo de prenda.' : !type.activo ? 'Elige un tipo de prenda activo.' : '',
    qty: !(qty > 0) || qty > MAX_MEASURE ? 'Cantidad mayor que cero.'
      : mode === 'UNIDAD' && !Number.isInteger(qty) ? 'Usa un número entero de unidades.'
      : !/^\d+(?:[.,]\d{1,3})?$/.test(f.qty.trim()) ? 'Usa como máximo tres decimales.' : '',
    price: !(price > 0) || price > MAX_PRICE ? 'Precio mayor que cero.' : !/^\d+(?:[.,]\d{1,2})?$/.test(f.price.trim()) ? 'Usa como máximo dos decimales.' : '',
    name: !f.name.trim() ? 'Escribe un nombre.' : '',
    start: !Number.isFinite(start.getTime()) ? 'Ingresa una fecha válida.' : '',
    end: !Number.isFinite(end.getTime()) ? 'Ingresa una fecha válida.' : Number.isFinite(start.getTime()) && end <= start ? 'El fin debe ser posterior al inicio.' : '',
  }
  const er = Object.fromEntries(Object.entries(problems).map(([key, value]) => [key, touched ? value : ''])) as typeof problems

  const suggest = type && qty > 0 && price > 0 ? `${mode === 'UNIDAD' ? `${measure(qty)} ${qty === 1 ? 'unidad' : 'unidades'}` : qtyText(qty, mode)} por Q${plain(price)}` : ''
  const base = type?.precio && qty > 0 ? type.precio * qty : 0
  let saveText = 'Completa cantidad y precio'
  let saveCls = 'ct-pvs none'
  if (type && qty > 0 && price > 0) {
    if (!base) saveText = 'Tipo sin tarifa base configurada'
    else if (base > price) { saveText = `Ahorra ${money(base - price)} (${Math.round((base - price) / base * 100)}%) vs. ${money(base)}`; saveCls = 'ct-pvs' }
    else { saveText = `No genera ahorro: la tarifa base es ${money(base)}`; saveCls = 'ct-pvs bad' }
  }

  async function save() {
    setTouched(true)
    if (Object.values(problems).some(Boolean) || !type) return
    const payload: PromotionPayload = { nombre: f.name.trim(), descripcion: f.desc.trim(), tipo_prenda_id: type.id, modalidad_cobro: mode, medida_requerida: qty, precio_promocional: price, fecha_inicio: start.toISOString(), fecha_fin: end.toISOString(), activo: f.active }
    setSaving(true)
    setServerError('')
    try {
      const saved = await savePromotion(payload, item?.id)
      onSaved(saved)
    } catch (cause) {
      setServerError(errorMessage(cause))
      setSaving(false)
    }
  }

  const preview = <div className="ct-pvc">
    <div className="ct-stub"><span className="ct-sq">{type && qty > 0 ? qtyText(qty, mode) : '—'}</span><span className="ct-sarr">por</span><span className="ct-sp">{price > 0 ? `Q${plain(price)}` : 'Q —'}</span></div>
    <div className="ct-cperf" />
    <div style={{ padding: '16px 18px 16px 4px', minWidth: 0, flex: 1, color: '#0A2433' }}>
      <p className="ct-name" style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name.trim() || suggest || 'Nombre de la promoción'}</p>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: '#3E5866' }}>{type ? `${type.nombre} · ${mode}` : 'Elige un tipo de prenda'}</p>
      <p className={saveCls}>{saveText}</p>
    </div>
  </div>

  return <CatalogModal eyebrow={item ? 'EDITAR' : 'NUEVA'} title={item ? 'Editar promoción' : 'Nueva promoción'} width={680} preview={preview} busy={saving} onClose={onClose} onSubmit={() => void save()} saveLabel="Guardar promoción">
    <Field label="Tipo de prenda" required span error={er.type}>
      {options.length ? <div className="ct-opts" role="radiogroup" aria-label="Tipo de prenda">
        {options.map((entry) => { const entryMode = modeOf(entry.modalidad_cobro); return <button key={entry.id} type="button" role="radio" aria-checked={entry.id === f.typeId} className="ct-opt" disabled={!entry.activo} onClick={() => set({ typeId: entry.id })}>
          {entry.nombre} <small>{entry.precio ? `Q${plain(entry.precio)} ${MODES[entryMode].per}` : 'sin precio'}{!entry.activo ? ' · inactivo' : ''}</small>
        </button> })}
      </div> : <p className="ct-hint" style={{ margin: 0 }}>No hay tipos de prenda activos.</p>}
    </Field>
    <Field label={type ? MODES[mode].qtyLabel : 'Cantidad requerida'} htmlFor="ct-p-qty" required error={er.qty}>
      <div className={`ct-pfx${er.qty ? ' bad' : ''}`}><input id="ct-p-qty" type="text" inputMode="decimal" placeholder="0" value={f.qty} onChange={(event) => set({ qty: onlyDecimal(event.target.value) })} /><em>{type ? (mode === 'UNIDAD' ? 'unidades' : MODES[mode].short) : ''}</em></div>
    </Field>
    <Field label="Precio promocional" htmlFor="ct-p-price" required error={er.price}>
      <div className={`ct-pfx${er.price ? ' bad' : ''}`}><span>Q</span><input id="ct-p-price" type="text" inputMode="decimal" placeholder="0.00" value={f.price} onChange={(event) => set({ price: onlyDecimal(event.target.value) })} /></div>
    </Field>
    <Field label="Nombre" htmlFor="ct-p-name" required span error={er.name}>
      <input className={`ct-mi${er.name ? ' bad' : ''}`} id="ct-p-name" type="text" maxLength={100} placeholder="Ej. 5 lb por Q50" value={f.name} onChange={(event) => set({ name: event.target.value })} />
      {suggest && suggest !== f.name && <button className="ct-sug" type="button" onClick={() => set({ name: suggest })}><PathIcon d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" size={14} strokeWidth={2.2} />Usar “{suggest}”</button>}
    </Field>
    <Field label="Descripción" htmlFor="ct-p-desc" span>
      <textarea className="ct-mi" id="ct-p-desc" rows={2} maxLength={500} placeholder="Opcional" value={f.desc} onChange={(event) => set({ desc: event.target.value })} />
    </Field>
    <Field label="Inicio" htmlFor="ct-p-start" required error={er.start}>
      <input className={`ct-mi${er.start ? ' bad' : ''}`} id="ct-p-start" type="datetime-local" value={f.start} onChange={(event) => set({ start: event.target.value })} />
    </Field>
    <Field label="Fin" htmlFor="ct-p-end" required error={er.end}>
      <input className={`ct-mi${er.end ? ' bad' : ''}`} id="ct-p-end" type="datetime-local" value={f.end} onChange={(event) => set({ end: event.target.value })} />
    </Field>
    <div className="ct-mr ct-span2">
      <button className="ct-swrow" type="button" role="switch" aria-checked={f.active} aria-label="Activa" onClick={() => set({ active: !f.active })}>
        <span className="ct-trk"><span className="ct-knb" /></span>
        <span><span style={{ display: 'block', fontWeight: 600 }}>Activa</span><small>Se ofrece en pedidos nuevos mientras esté vigente</small></span>
      </button>
    </div>
    {serverError && <div className="ct-merr" role="alert">{serverError}</div>}
  </CatalogModal>
}

export function PromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([])
  const [types, setTypes] = useState<TipoPrenda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Promotion | null | undefined>()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [freshId, setFreshId] = useState(0)
  const [reload, setReload] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const canManage = useAuth((state) => state.roleId) === 1
  const toast = useToast(2400)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true); setError('')
      Promise.all([listPromotions(controller.signal), listGarmentTypes()]).then(([promotions, garmentTypes]) => {
        if (controller.signal.aborted) return
        setItems(promotions ?? []); setTypes(garmentTypes ?? []); setNow(Date.now())
      }).catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [reload])

  async function toggle(item: Promotion) {
    if (busyId != null) return
    setBusyId(item.id)
    try {
      const updated = await setPromotionActive(item.id, !item.activo)
      setItems((list) => list.map((entry) => entry.id === item.id ? { ...entry, ...(updated ?? {}), activo: !item.activo } : entry))
      toast.show(`${item.nombre} ${item.activo ? 'desactivada' : 'activada'}`)
    } catch (cause) {
      toast.show(errorMessage(cause), true)
    } finally {
      setBusyId(null)
    }
  }

  async function cleanCopies(copies: Promotion[], name: string) {
    if (busyId != null) return
    const active = copies.filter((copy) => copy.activo)
    if (!active.length) return
    setBusyId(active[0].id)
    try {
      for (const copy of active) await setPromotionActive(copy.id, false)
      const ids = new Set(active.map((copy) => copy.id))
      setItems((list) => list.map((entry) => ids.has(entry.id) ? { ...entry, activo: false } : entry))
      toast.show(`Copias de ${name} desactivadas`)
    } catch (cause) {
      toast.show(errorMessage(cause), true)
      setReload((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  const typeById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types])
  const ordered = useMemo(() => items.slice().sort((a, b) => a.id - b.id), [items])
  const groups = useMemo(() => {
    const map = new Map<string, Promotion[]>()
    ordered.forEach((item) => { const key = dupKey(item); map.set(key, [...(map.get(key) ?? []), item]) })
    return map
  }, [ordered])
  const originals = ordered.filter((item) => groups.get(dupKey(item))?.[0].id === item.id)
  const repeated = [...groups.values()].filter((group) => group.length > 1)
  const copiesCount = repeated.reduce((sum, group) => sum + group.length - 1, 0)
  const baseOf = (item: Promotion) => { const price = typeById.get(item.tipo_prenda_id)?.precio; return price ? price * item.medida_requerida : 0 }
  const typeName = (item: Promotion) => typeById.get(item.tipo_prenda_id)?.nombre ?? item.tipo_prenda_nombre
  const live = originals.filter((item) => validity(item, now)[0] === 'Vigente')
  const best = live.reduce((max, item) => { const base = baseOf(item); return base ? Math.max(max, Math.round((base - item.precio_promocional) / base * 100)) : max }, 0)
  const q = query.trim().toLowerCase()
  const list = originals
    .filter((item) => tab === 0 || (tab === 1 ? validity(item, now)[0] === 'Vigente' : !item.activo))
    .filter((item) => !q || `${item.nombre} ${typeName(item)}`.toLowerCase().includes(q))
  const editIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></svg>
  const chip = (item: Promotion, on: boolean) => <span className="pm-cchip" style={{ background: on ? '#0A2433' : '#9DB3BE' }}><span className="ad-disp pm-cq">{qtyText(item.medida_requerida, item.modalidad_cobro)}</span><span className="ad-disp pm-cp">Q{plain(item.precio_promocional)}</span></span>
  const switchFor = (item: Promotion, label: string) => {
    const status = validity(item, now)[0]
    return canManage
      ? <button className="ct-sw" type="button" role="switch" aria-checked={item.activo} aria-label={`Activar o desactivar ${label}`} disabled={busyId === item.id} onClick={() => void toggle(item)}><span className="ct-trk"><span className="ct-knb" /></span><span className="pm-stt">{status}</span></button>
      : <span className="ct-sw ro" role="switch" aria-checked={item.activo} aria-readonly="true" aria-label={`Estado de ${label}`}><span className="ct-trk"><span className="ct-knb" /></span><span className="pm-stt">{status}</span></span>
  }
  const range = (item: Promotion) => `${shortDate(item.fecha_inicio)} – ${shortDate(item.fecha_fin)}`

  return <section className="ct-page">
    <CatalogHead title="Promociones" sub="Gestiona paquetes por unidad, libra o metro sin cambiar las tarifas base.">{canManage && <NewButton label="Nueva promoción" onClick={() => setEditing(null)} />}</CatalogHead>
    <section className="ct-stats three ad-st" style={{ animationDelay: '.18s' }}>
      <div className="dark"><p className="k">Vigentes ahora</p><p className="v">{live.length}</p></div>
      <div><p className="k">Inactivas</p><p className="v" style={{ color: '#5A7280' }}>{originals.filter((item) => !item.activo).length}</p></div>
      <div><p className="k">Mejor ahorro vigente</p><p className="v" style={{ color: '#06709F' }}>{best > 0 ? `${best}%` : '—'}</p></div>
    </section>
    <CatalogTools query={query} onQuery={setQuery} placeholder="Buscar por nombre o tipo de prenda…" tabs={['Todas', 'Vigentes', 'Inactivas', `Repetidas (${copiesCount})`]} tab={tab} onTab={setTab} />
    {error && <ErrorBanner message={error} onRetry={() => setReload((n) => n + 1)} />}
    {tab !== 3 ? <section className="pm-plist ad-st" style={{ animationDelay: '.26s' }}>
      {loading && !items.length ? <LoadingCard text="Cargando promociones…" />
        : error ? null
        : list.length === 0 ? <div className="pm-empty"><p className="ad-disp">{items.length ? 'Sin promociones' : 'Aún no hay promociones.'}</p><p>{items.length ? 'Cambia el filtro o crea una nueva.' : canManage ? 'Crea la primera promoción para comenzar.' : 'Todavía no se han registrado.'}</p></div>
        : list.map((item, index) => {
          const base = baseOf(item)
          const start = Date.parse(item.fecha_inicio), end = Date.parse(item.fecha_fin)
          const left = Math.ceil((end - now) / 86400000)
          const saving = base > item.precio_promocional
          const unit = MODES[modeOf(item.modalidad_cobro)].per
          return <div key={item.id} className={`pm-row${item.activo ? '' : ' off'}${groups.get(dupKey(item))?.some((entry) => entry.id === freshId) ? ' fresh' : ''}`} style={{ animationDelay: `${(0.28 + Math.min(index, 14) * 0.05).toFixed(2)}s` }} aria-label={item.nombre} role="group">
            <div className="pm-prw">
              {chip(item, item.activo)}
              <div style={{ minWidth: 0 }}><p className="ad-disp pm-pn">{item.nombre}</p><p className="pm-pm">{typeName(item)} · {unit}</p></div>
              {base > 0 ? <span className={`pm-sv3${saving ? '' : ' bad'}`}>{saving ? `−${Math.round((base - item.precio_promocional) / base * 100)}% · ahorra ${money(base - item.precio_promocional)}` : 'Sin ahorro'}</span> : <span />}
              <span className="pm-pv2"><span style={{ display: 'block', fontWeight: 600, color: left <= 7 && left > 0 ? '#C8401F' : '#0A2433' }}>{now > end ? 'Finalizó' : now < start ? `Empieza ${shortDate(item.fecha_inicio)}` : `Quedan ${left} días`}</span><span>Hasta {shortDate(item.fecha_fin)}</span></span>
              {switchFor(item, item.nombre)}
              {canManage ? <button className="pm-ib2" type="button" aria-label={`Editar ${item.nombre}`} onClick={() => setEditing(item)}>{editIcon}</button> : <span />}
            </div>
          </div>
        })}
    </section>
      : <section className="pm-rvw">
        <div className="pm-rvhead ad-st"><span className="pm-dbi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg></span><div style={{ flex: 1 }}><p className="ad-disp" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Promociones repetidas</p><p style={{ margin: '2px 0 0', fontSize: 14, color: '#5E4500' }}>Tienen el mismo nombre, prenda, cantidad y precio. Conserva la original y desactiva las copias.</p></div></div>
        {repeated.length === 0 ? <div className="pm-plist pm-empty"><p className="ad-disp">Todo en orden</p><p>No hay promociones repetidas.</p></div>
          : repeated.map((group, gi) => {
            const [original, ...copies] = group
            const copiesOn = copies.some((copy) => copy.activo)
            return <article key={original.id} className="pm-rvc" style={{ animationDelay: `${(0.1 + gi * 0.06).toFixed(2)}s` }} aria-label={`${original.nombre} repetida`}>
              <div className="pm-rvt">
                {chip(original, true)}
                <div style={{ minWidth: 0, flex: 1 }}><p className="ad-disp pm-pn">{original.nombre}</p><p className="pm-pm">{typeName(original)} · {group.length} registros iguales</p></div>
                {canManage && copiesOn ? <button className="pm-clean2" type="button" disabled={busyId != null} onClick={() => void cleanCopies(copies, original.nombre)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Dejar solo la original</button>
                  : !copiesOn ? <span className="pm-okp">Copias desactivadas</span> : null}
              </div>
              {group.map((entry, ci) => <div key={entry.id} className="pm-cpy2">
                <span className={`pm-tg${ci === 0 ? ' orig' : ''}`}>{ci === 0 ? 'Original' : `Copia ${ci}`}</span>
                <span style={{ fontSize: 13, color: '#5A7280' }}>{range(entry)}</span>
                {switchFor(entry, ci === 0 ? `${entry.nombre} original` : `${entry.nombre} copia ${ci}`)}
                {canManage ? <button className="pm-ib2" type="button" aria-label={`Editar ${ci === 0 ? 'original' : `copia ${ci}`} de ${entry.nombre}`} onClick={() => setEditing(entry)}>{editIcon}</button> : <span />}
              </div>)}
            </article>
          })}
      </section>}
    {editing !== undefined && <PromotionForm item={editing} types={types} onClose={() => setEditing(undefined)} onSaved={(saved) => {
      setEditing(undefined); setFreshId(saved?.id ?? editing?.id ?? 0); setTab(0); toast.show(editing ? 'Promoción actualizada' : 'Promoción creada'); setReload((n) => n + 1)
    }} />}
    {toast.node}
  </section>
}
