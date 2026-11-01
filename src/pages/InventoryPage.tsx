import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createInput, deactivateInput, listInputs, listLowStockInputs, registerInventoryMovement, updateInput } from '../api/inventory'
import { errorMessage } from '../api/client'
import { ActiveSwitch, CardFoot, CatalogHead, CatalogModal, CatalogTools, EditButton, EmptyCard, ErrorBanner, Field, LoadingCard, NewButton } from '../components/admin/CatalogKit'
import { PathIcon } from '../components/admin/icons'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../store/auth'
import type { Insumo, TipoMovimientoInventario } from '../types'
import { cardDelay, filterByTab, fmtN, onlyDecimal, parseNum, stockState, tankCap } from '../utils/catalogLook'
import '../styles/catalogs.css'

const UNITS = ['unidad', 'L', 'ml', 'kg', 'g']
const MOVE_ICON = 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4'
const IN_ICON = 'M12 19V5M5 12l7 7 7-7'
const OUT_ICON = 'M12 5v14M5 12l7-7 7 7'

type LogEntry = { id: number; name: string; kind: TipoMovimientoInventario; qty: number; unit: string; note: string; when: string }

function Tank({ stock, min, color, dark, small, label, capacity }: { stock: number; min: number; color: string; dark?: boolean; small?: boolean; label?: string; capacity?: number }) {
  const cap = capacity ? Math.max(capacity, stock, 1) : tankCap(Math.max(stock, 0), Math.max(min, 0))
  const level = Math.round(Math.max(stock, 0) / cap * 100)
  return <div className={`ct-tank${dark ? ' dk' : ''}${small ? ' sm' : ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <div className="ct-lvl" style={{ height: `${level}%`, background: color }}>
      {!small && <svg viewBox="0 0 400 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q 25 0 50 7 T 100 7 T 150 7 T 200 7 T 250 7 T 300 7 T 350 7 T 400 7 V14 H0 Z" fill={color} /></svg>}
    </div>
    {!small && <span className="ct-minl" style={{ bottom: `${Math.round(Math.max(min, 0) / cap * 100)}%` }}><em>mín</em></span>}
  </div>
}

function StateBadge({ state }: { state: [string, string, string, string] }) {
  return <span className="ct-stb" style={{ background: state[1], color: state[2] }}><i />{state[0]}</span>
}

export function InventoryPage() {
  const roleId = useAuth((state) => state.roleId)
  const canManage = roleId === 1 || roleId === 2
  const canMove = roleId === 1 || roleId === 3
  const [items, setItems] = useState<Insumo[]>([])
  const [lowIds, setLowIds] = useState<Set<number>>(new Set())
  /** Capacidad de referencia de cada tanque: se mantiene fija para que el agua suba o baje al registrar movimientos. */
  const [caps, setCaps] = useState<Map<number, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Insumo | null | undefined>()
  const [moving, setMoving] = useState<number | null | undefined>()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [freshId, setFreshId] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const toast = useToast(2400)
  const request = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const [response, low] = await Promise.all([listInputs(controller.signal), listLowStockInputs(controller.signal)])
      if (!controller.signal.aborted) { setItems(response ?? []); setCaps((current) => { const next = new Map(current); (response ?? []).forEach((item) => next.set(item.id, Math.max(current.get(item.id) ?? 0, tankCap(Math.max(item.stock_actual, 0), Math.max(item.stock_minimo, 0))))); return next }); setLowIds(new Set((low ?? []).map((item) => item.id))) }
    } catch (cause) {
      if (!controller.signal.aborted) { setItems([]); setLowIds(new Set()); setError(errorMessage(cause)) }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])

  async function toggle(item: Insumo) {
    if (busyId != null) return
    setBusyId(item.id)
    try {
      if (item.activo) await deactivateInput(item.id)
      else await updateInput(item.id, { activo: true })
      setItems((list) => list.map((entry) => entry.id === item.id ? { ...entry, activo: !item.activo } : entry))
      toast.show(`${item.nombre} ${item.activo ? 'desactivado' : 'activado'}`)
    } catch (cause) {
      toast.show(errorMessage(cause), true)
    } finally {
      setBusyId(null)
    }
  }

  const active = items.filter((item) => item.activo)
  const isLow = (item: Insumo) => item.stock_actual > 0 && (lowIds.has(item.id) || item.stock_actual <= item.stock_minimo)
  const list = useMemo(() => filterByTab(items, tab, query, (item) => `${item.nombre} ${item.descripcion ?? ''} ${item.unidad_medida}`), [items, tab, query])

  return <section className="ct-page">
    <CatalogHead title="Insumos" sub="Gestiona existencias, unidades de medida y niveles mínimos.">
      {canMove && <button className="ct-secb" type="button" onClick={() => setMoving(null)}><PathIcon d={MOVE_ICON} size={20} strokeWidth={2.2} />Registrar movimiento</button>}
      {canManage && <NewButton label="Nuevo insumo" onClick={() => setEditing(null)} />}
    </CatalogHead>
    <section className="ct-stats ad-st" style={{ animationDelay: '.18s' }}>
      <div className="dark"><p className="k">Insumos activos</p><p className="v">{active.length}</p></div>
      <div><p className="k">Disponibles</p><p className="v" style={{ color: '#1F8A5B' }}>{active.filter((item) => item.stock_actual > 0 && !isLow(item)).length}</p></div>
      <div className="warn"><p className="k">Stock bajo</p><p className="v" style={{ color: '#9A6A00' }}>{active.filter(isLow).length}</p></div>
      <div><p className="k">Agotados</p><p className="v" style={{ color: '#C8401F' }}>{active.filter((item) => item.stock_actual <= 0).length}</p></div>
    </section>
    <CatalogTools query={query} onQuery={setQuery} placeholder="Buscar insumo…" tabs={['Todos', 'Activos', 'Inactivos']} tab={tab} onTab={setTab} />
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}

    <div className="ct-inslay">
      <section className="ct-grid w300" style={{ marginTop: 18 }}>
        {loading && !items.length ? <LoadingCard text="Cargando insumos…" />
          : error ? null
          : list.length === 0 ? <EmptyCard title={items.length ? 'Sin insumos' : 'Aún no hay insumos'} text={items.length ? 'Cambia el filtro o registra un insumo nuevo.' : 'Crea el primer registro para comenzar.'} />
          : list.map((item, index) => {
            const state = stockState(item.stock_actual, item.stock_minimo, item.activo, lowIds.has(item.id))
            return <article key={item.id} className={`ct-card${item.activo ? '' : ' off'}${item.id === freshId ? ' fresh' : ''}`} style={{ animationDelay: cardDelay(index) }} aria-label={item.nombre}>
              <div className="ct-dim" style={{ padding: 20, display: 'flex', gap: 18 }}>
                <Tank stock={item.stock_actual} min={item.stock_minimo} color={state[3]} capacity={caps.get(item.id)} label={`Stock ${fmtN(item.stock_actual)} de mínimo ${fmtN(item.stock_minimo)}`} />
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}><p className="ct-name" style={{ fontSize: 22 }}>{item.nombre}</p><StateBadge state={state} /></div>
                  <p className="ct-desc" style={{ marginTop: 2 }}>{item.descripcion || 'Sin descripción'}</p>
                  <p className="ct-stock">{fmtN(item.stock_actual)} <span>{item.unidad_medida}</span></p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5A7280' }}>Mínimo: <strong style={{ color: '#0A2433' }}>{fmtN(item.stock_minimo)} {item.unidad_medida}</strong></p>
                  {canMove && item.activo && <button className="ct-movb" type="button" aria-label={`Registrar movimiento de ${item.nombre}`} onClick={() => setMoving(item.id)}><PathIcon d={MOVE_ICON} size={16} strokeWidth={2.2} />Movimiento</button>}
                </div>
              </div>
              <CardFoot>
                <ActiveSwitch active={item.activo} name={item.nombre} busy={busyId === item.id} onToggle={canManage ? () => void toggle(item) : undefined} />
                {canManage && <EditButton name={item.nombre} onClick={() => setEditing(item)} />}
              </CardFoot>
            </article>
          })}
      </section>
      <aside className="ct-movlog ad-st" style={{ animationDelay: '.3s' }} aria-label="Movimientos recientes">
        <p className="ct-name" style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>Movimientos recientes</p>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#5A7280' }}>Registrados en esta sesión</p>
        {log.length === 0 ? <p className="ct-nolog">Aún no hay movimientos.</p>
          : log.slice().reverse().map((entry, index) => <div key={entry.id} className="ct-lg" style={{ animationDelay: `${(index * 0.04).toFixed(2)}s` }}>
            <span className={`ct-lgi ${entry.kind === 'entrada' ? 'in' : 'out'}`}><PathIcon d={entry.kind === 'entrada' ? IN_ICON : OUT_ICON} size={18} strokeWidth={2.4} /></span>
            <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', fontWeight: 600 }}>{entry.name}</span><span style={{ fontSize: 12, color: '#5A7280' }}>{entry.when}{entry.note ? ` · ${entry.note}` : ''}</span></span>
            <strong className="ad-disp" style={{ color: entry.kind === 'entrada' ? '#1F8A5B' : '#B5541A' }}>{entry.kind === 'entrada' ? '+' : '−'}{fmtN(entry.qty)} {entry.unit}</strong>
          </div>)}
      </aside>
    </div>

    {editing !== undefined && <InventoryForm item={editing} onClose={() => setEditing(undefined)} onSaved={(id, message) => { setEditing(undefined); setFreshId(id); setTab(0); toast.show(message); void load() }} />}
    {moving !== undefined && <MovementForm items={active} initialId={moving} onClose={() => setMoving(undefined)} onSaved={(entry, message) => {
      setMoving(undefined); setFreshId(entry.id); setLog((current) => [...current, { ...entry, id: Date.now() }]); toast.show(message); void load()
    }} />}
    {toast.node}
  </section>
}

function InventoryForm({ item, onClose, onSaved }: { item: Insumo | null; onClose: () => void; onSaved: (id: number, message: string) => void }) {
  const [f, setF] = useState({ name: item?.nombre ?? '', desc: item?.descripcion ?? '', unit: item?.unidad_medida ?? '', stock: String(item?.stock_actual ?? 0), min: String(item?.stock_minimo ?? 0) })
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const set = (patch: Partial<typeof f>) => setF((current) => ({ ...current, ...patch }))
  const stock = parseNum(f.stock)
  const min = parseNum(f.min)
  const valid = { name: !!f.name.trim(), unit: !!f.unit.trim(), stock: stock >= 0, min: min >= 0 }
  const er = { name: touched && !valid.name, unit: touched && !valid.unit, stock: touched && !valid.stock, min: touched && !valid.min }
  const unitText = f.unit.trim() || 'unid.'
  const previewState = stockState(stock >= 0 ? stock : 0, min >= 0 ? min : 0, true)

  async function save() {
    setTouched(true)
    if (!Object.values(valid).every(Boolean)) return
    setSaving(true)
    setServerError('')
    const descripcion = f.desc.trim()
    const payload = { nombre: f.name.trim(), unidad_medida: f.unit.trim(), stock_actual: stock, stock_minimo: min, ...(descripcion && { descripcion }) }
    try {
      const saved = item ? await updateInput(item.id, payload) : await createInput(payload)
      onSaved(saved?.id ?? item?.id ?? 0, item ? 'Insumo actualizado' : 'Insumo creado')
    } catch (cause) {
      setServerError(errorMessage(cause))
      setSaving(false)
    }
  }

  const preview = <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
    <Tank stock={stock >= 0 ? stock : 0} min={min >= 0 ? min : 0} color={previewState[3]} dark />
    <div style={{ minWidth: 0 }}>
      <p className="ct-name" style={{ fontSize: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name.trim() || 'Nombre del insumo'}</p>
      <p className="ct-name" style={{ margin: '6px 0 0', fontSize: 34, color: '#FFC93C', lineHeight: 1 }}>{stock >= 0 ? fmtN(stock) : '0'} <span style={{ fontSize: 15, color: '#A9C1CD' }}>{f.unit.trim()}</span></p>
      <p style={{ margin: '8px 0 0' }}><StateBadge state={previewState} /></p>
    </div>
  </div>

  return <CatalogModal eyebrow={item ? 'EDITAR' : 'NUEVO'} title={item ? 'Editar insumo' : 'Nuevo insumo'} preview={preview} busy={saving} onClose={onClose} onSubmit={() => void save()} saveLabel="Guardar insumo" formLabel="Formulario de insumo">
    <Field label="Nombre" htmlFor="ct-i-name" required span error={er.name ? 'Escribe un nombre.' : ''}>
      <input className={`ct-mi${er.name ? ' bad' : ''}`} id="ct-i-name" type="text" autoFocus maxLength={100} placeholder="Ej. Suavizante" value={f.name} onChange={(event) => set({ name: event.target.value })} />
    </Field>
    <Field label="Descripción" htmlFor="ct-i-desc" span>
      <textarea className="ct-mi" id="ct-i-desc" rows={2} maxLength={255} placeholder="Opcional" value={f.desc} onChange={(event) => set({ desc: event.target.value })} />
    </Field>
    <Field label="Unidad de medida" htmlFor="ct-i-unit" required span error={er.unit ? 'Indica la unidad.' : ''}>
      <div className="ct-opts" style={{ marginBottom: 8 }}>{UNITS.map((unit) => <button key={unit} type="button" className={`ct-opt${f.unit === unit ? ' on' : ''}`} aria-pressed={f.unit === unit} onClick={() => set({ unit })}>{unit}</button>)}</div>
      <input className={`ct-mi${er.unit ? ' bad' : ''}`} id="ct-i-unit" type="text" maxLength={20} placeholder="L, kg, unidad…" value={f.unit} onChange={(event) => set({ unit: event.target.value })} />
    </Field>
    <Field label="Stock actual" htmlFor="ct-i-stock" required error={er.stock ? 'Número igual o mayor que cero.' : ''}>
      <div className={`ct-pfx${er.stock ? ' bad' : ''}`}><input id="ct-i-stock" type="text" inputMode="decimal" value={f.stock} onChange={(event) => set({ stock: onlyDecimal(event.target.value) })} /><em>{unitText}</em></div>
    </Field>
    <Field label="Stock mínimo" htmlFor="ct-i-min" required error={er.min ? 'Número igual o mayor que cero.' : ''}>
      <div className={`ct-pfx${er.min ? ' bad' : ''}`}><input id="ct-i-min" type="text" inputMode="decimal" value={f.min} onChange={(event) => set({ min: onlyDecimal(event.target.value) })} /><em>{unitText}</em></div>
    </Field>
    {serverError && <div className="ct-merr" role="alert">{serverError}</div>}
  </CatalogModal>
}

function MovementForm({ items, initialId, onClose, onSaved }: { items: Insumo[]; initialId: number | null; onClose: () => void; onSaved: (entry: Omit<LogEntry, 'id'> & { id: number }, message: string) => void }) {
  const [itemId, setItemId] = useState<number>(initialId ?? (items.length === 1 ? items[0].id : 0))
  const [kind, setKind] = useState<TipoMovimientoInventario | ''>('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const selected = items.find((item) => item.id === itemId)
  const amount = parseNum(qty)
  const sign = kind === 'entrada' ? 1 : kind === 'salida' ? -1 : 0
  const after = selected ? selected.stock_actual + sign * (amount > 0 ? amount : 0) : 0
  const tooMuch = !!selected && kind === 'salida' && amount > selected.stock_actual
  const qtyError = tooMuch ? `No hay suficiente stock: solo quedan ${fmtN(selected.stock_actual)} ${selected.unidad_medida}.` : touched && !(amount > 0) ? 'Escribe una cantidad mayor que cero.' : ''
  const lowWarn = !!selected && kind === 'salida' && amount > 0 && !tooMuch && after <= selected.stock_minimo
  const cap = selected ? tankCap(Math.max(selected.stock_actual, after), selected.stock_minimo) : 1
  const afterColor = selected && after < 0 ? '#F08A63' : selected && after <= selected.stock_minimo ? '#FFC93C' : '#7EE0B5'

  async function save() {
    setTouched(true)
    if (!selected || !kind || !(amount > 0) || tooMuch) return
    setSaving(true)
    setServerError('')
    try {
      await registerInventoryMovement({ insumo_id: selected.id, tipo_movimiento: kind, cantidad: amount, ...(note.trim() && { motivo: note.trim() }) })
      const now = new Date()
      const when = `${now.getDate()}/${now.getMonth() + 1} · ${now.toLocaleTimeString('es-GT', { hour: 'numeric', minute: '2-digit' })}`
      onSaved({ id: selected.id, name: selected.nombre, kind, qty: amount, unit: selected.unidad_medida, note: note.trim(), when }, `${kind === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente.`)
    } catch (cause) {
      setServerError(errorMessage(cause))
      setSaving(false)
    }
  }

  const smallTank = (value: number, color: string): ReactNode => <div className="ct-tank dk sm" aria-hidden="true"><div className="ct-lvl" style={{ height: `${Math.round(Math.max(0, value) / cap * 100)}%`, background: color }} /></div>
  const preview = <div className="ct-mvpv">
    <div>{smallTank(selected?.stock_actual ?? 0, '#5BC3EC')}<b>{selected ? fmtN(selected.stock_actual) : '—'}</b><small>Actual</small></div>
    <div className="ct-mvarr" style={{ color: sign > 0 ? '#7EE0B5' : sign < 0 ? '#F7A787' : '#A9C1CD' }}><span>{sign && amount > 0 ? `${sign > 0 ? '+' : '−'}${fmtN(amount)}` : '±'}</span><svg width="56" height="18" viewBox="0 0 56 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 9h48M44 3l6 6-6 6" /></svg></div>
    <div>{smallTank(after, afterColor)}<b style={{ color: afterColor }}>{selected ? fmtN(Math.max(0, after)) : '—'}</b><small>Después · {selected?.unidad_medida ?? ''}</small></div>
  </div>

  return <CatalogModal eyebrow="INVENTARIO" title="Registrar movimiento" preview={preview} busy={saving} onClose={onClose} onSubmit={() => void save()} saveLabel="Registrar movimiento" busyLabel="Registrando…" formLabel="Formulario de movimiento de inventario">
    <Field label="Insumo" required span error={touched && !selected ? 'Elige un insumo.' : ''}>
      {items.length ? <div className="ct-opts" role="radiogroup" aria-label="Insumo">
        {items.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === itemId} className="ct-opt" onClick={() => setItemId(item.id)}>{item.nombre} <small>{fmtN(item.stock_actual)} {item.unidad_medida}</small></button>)}
      </div> : <p className="ct-hint" style={{ margin: 0 }}>No hay insumos activos.</p>}
    </Field>
    <Field label="Tipo de movimiento" required span error={touched && !kind ? 'Elige entrada o salida.' : ''}>
      <div className="ct-io" role="radiogroup" aria-label="Tipo de movimiento">
        <button type="button" role="radio" aria-checked={kind === 'entrada'} className="ct-iob in" onClick={() => setKind('entrada')}><span className="ct-ioi"><PathIcon d={IN_ICON} size={20} strokeWidth={2.4} /></span><span><b>Entrada</b><small>Suma al stock</small></span></button>
        <button type="button" role="radio" aria-checked={kind === 'salida'} className="ct-iob out" onClick={() => setKind('salida')}><span className="ct-ioi"><PathIcon d={OUT_ICON} size={20} strokeWidth={2.4} /></span><span><b>Salida</b><small>Resta del stock</small></span></button>
      </div>
    </Field>
    <Field label="Cantidad" htmlFor="ct-m-qty" required span error={qtyError}>
      <div className={`ct-qty${qtyError ? ' bad' : ''}`}>
        <button type="button" aria-label="Restar" onClick={() => setQty(String(Math.max(0, (amount > 0 ? amount : 0) - 1)))}><PathIcon d="M5 12h14" size={20} strokeWidth={2.4} /></button>
        <input id="ct-m-qty" type="text" inputMode="decimal" placeholder="0" value={qty} onChange={(event) => setQty(onlyDecimal(event.target.value))} />
        <span className="u">{selected?.unidad_medida ?? ''}</span>
        <button type="button" aria-label="Sumar" onClick={() => setQty(String((amount > 0 ? amount : 0) + 1))}><PathIcon d="M12 5v14M5 12h14" size={20} strokeWidth={2.4} /></button>
      </div>
      {lowWarn && <span className="ct-hint" style={{ color: '#9A6A00', fontWeight: 600 }}>Con esta salida quedará por debajo del mínimo.</span>}
    </Field>
    <Field label="Motivo u observación" htmlFor="ct-m-note" span>
      <textarea className="ct-mi" id="ct-m-note" rows={2} maxLength={255} placeholder="Opcional" value={note} onChange={(event) => setNote(event.target.value)} />
    </Field>
    {serverError && <div className="ct-merr" role="alert">{serverError}</div>}
  </CatalogModal>
}
