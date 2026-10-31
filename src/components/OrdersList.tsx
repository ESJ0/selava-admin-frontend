import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { listOrders, listOrderStatuses } from '../api/orders'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import type { EstadoPedido, PedidoListFilters, PedidoListResponse } from '../types'
import { avatarColors, calendarDay, daysBetween, formatShortDate, initials, isActiveOrder, money, orderCode, stageLook, startOfDay } from '../utils/adminFormat'
import { Pager, StatusChip } from './admin/AdminBits'
import { ChevronRightIcon, CloseIcon, FilterIcon, RefreshIcon, SearchIcon, SpinnerIcon } from './admin/icons'

const pageSize = 10

function readFilters(params: URLSearchParams) {
  return {
    search: params.get('q') ?? '', status: params.get('estado_id') ?? '',
    from: params.get('fecha_desde') ?? '', to: params.get('fecha_hasta') ?? '',
    order: params.get('orden') === 'antiguos' ? 'antiguos' as const : 'recientes' as const,
  }
}
type Filters = ReturnType<typeof readFilters>

function toParams(filters: Filters) {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set('q', filters.search.trim())
  if (filters.status) params.set('estado_id', filters.status)
  if (filters.from) params.set('fecha_desde', filters.from)
  if (filters.to) params.set('fecha_hasta', filters.to)
  if (filters.order === 'antiguos') params.set('orden', filters.order)
  return params
}

export function OrdersList({ detailBase }: { detailBase: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.toString()
  const applied = useMemo(() => readFilters(new URLSearchParams(query)), [query])
  const rawPage = Number(searchParams.get('pagina') ?? 1)
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1
  const [searchDraft, setSearchDraft] = useState({ query, value: applied.search })
  const searchText = searchDraft.query === query ? searchDraft.value : applied.search
  const [dateDraft, setDateDraft] = useState({ query, from: applied.from, to: applied.to })
  const dates = dateDraft.query === query ? dateDraft : { query, from: applied.from, to: applied.to }
  const [result, setResult] = useState<PedidoListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [statuses, setStatuses] = useState<EstadoPedido[]>([])
  const [statusError, setStatusError] = useState('')
  const [statusReload, setStatusReload] = useState(0)
  const searchTimer = useRef<number | undefined>(undefined)
  const overview = useOrdersOverview(state => state.orders)
  const overviewReady = useOrdersOverview(state => state.status === 'ready')
  const loadOverview = useOrdersOverview(state => state.load)

  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatusError('')
      void listOrderStatuses(controller.signal).then(data => {
        if (!controller.signal.aborted) setStatuses([...(data ?? [])].sort((a, b) => a.orden - b.orden))
      }).catch(cause => {
        if (!controller.signal.aborted) setStatusError(errorMessage(cause))
      })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [statusReload])

  useEffect(() => {
    const controller = new AbortController()
    const params: PedidoListFilters = {
      q: applied.search.trim() || undefined,
      estado_id: applied.status ? Number(applied.status) : undefined,
      fecha_desde: applied.from || undefined, fecha_hasta: applied.to || undefined,
      pagina: page, limite: pageSize, orden: applied.order,
    }
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      setResult(null)
      void listOrders(params, controller.signal).then(data => {
        if (!controller.signal.aborted) setResult(data)
      }).catch(cause => {
        if (!controller.signal.aborted) setError(errorMessage(cause))
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [applied, page, reload])

  /** Aplica filtros al instante (vuelve a la página 1). */
  function apply(next: Filters) {
    const params = toParams(next)
    if (params.toString() === query) setReload(value => value + 1)
    else setSearchParams(params)
  }

  function changeSearch(value: string) {
    setSearchDraft({ query, value })
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => apply({ ...applied, search: value }), 400)
  }

  function changeDate(field: 'from' | 'to', value: string) {
    const next = { ...dates, [field]: value }
    setDateDraft({ query, from: next.from, to: next.to })
    if (next.from && next.to && next.from > next.to) return
    apply({ ...applied, from: next.from, to: next.to })
  }

  function changePage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next > 1) params.set('pagina', String(next))
    else params.delete('pagina')
    setSearchParams(params)
  }

  function clearAll() {
    window.clearTimeout(searchTimer.current)
    setSearchDraft({ query: '', value: '' })
    setDateDraft({ query: '', from: '', to: '' })
    if (!query) setReload(value => value + 1)
    else setSearchParams(new URLSearchParams())
  }

  function refresh() {
    setReload(value => value + 1)
    setStatusReload(value => value + 1)
    void loadOverview(true)
  }

  const invalidRange = Boolean(dates.from && dates.to && dates.from > dates.to)
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize))
  const hasFilters = Boolean(applied.search || applied.status || applied.from || applied.to)
  const anyFilter = hasFilters || applied.order !== 'recientes' || Boolean(searchText) || Boolean(dates.from || dates.to)
  const today = startOfDay()

  // Conteos por estado sobre todos los pedidos (resumen en caché).
  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const order of overview) map.set(order.estado_actual.id, (map.get(order.estado_actual.id) ?? 0) + 1)
    return map
  }, [overview])
  const chips = [{ id: '', label: 'Todos', dot: '#0A2433', count: overviewReady ? overview.length : undefined }, ...statuses.map(status => ({ id: String(status.id), label: status.nombre, dot: stageLook(status)[1], count: overviewReady ? counts.get(status.id) ?? 0 : undefined }))]
  if (applied.status && !statuses.some(status => String(status.id) === applied.status)) chips.push({ id: applied.status, label: 'Estado seleccionado', dot: '#5A7280', count: undefined })

  return <section aria-labelledby="orders-list-title">
    <h2 id="orders-list-title" className="ad-sr">Todos los pedidos</h2>
    <section className="ad-chipsrow ad-st" style={{ animationDelay: '.2s' }} role="group" aria-label="Filtrar por estado">
      {chips.map(chip => {
        const selected = applied.status === chip.id
        return <button key={chip.id || 'todos'} type="button" className={`ad-stc${selected ? ' on' : ''}${chip.count === 0 ? ' zero' : ''}`} aria-pressed={selected} onClick={() => apply({ ...applied, status: chip.id })}>
          <i style={{ background: chip.dot }} />{chip.label}{chip.count !== undefined && <span className="cc">{chip.count}</span>}
        </button>
      })}
    </section>
    {statusError && <div className="ad-banner err" role="alert">No se pudieron cargar los estados. {statusError}<button type="button" onClick={() => setStatusReload(value => value + 1)}>Reintentar estados</button></div>}

    <section className="ad-filters ad-st" style={{ animationDelay: '.26s' }} aria-label="Filtros de pedidos">
      <label className="ad-f grow"><span>Buscar pedido o cliente</span>
        <span className="ad-fi"><SearchIcon size={18} stroke="#5A7280" /><input type="search" aria-label="Buscar pedido o cliente" maxLength={100} placeholder="Número, nombre o teléfono" value={searchText} onChange={event => changeSearch(event.target.value)} /></span></label>
      <label className="ad-f"><span>Recibido desde</span><span className="ad-fi"><input type="date" aria-label="Recibido desde" value={dates.from} onChange={event => changeDate('from', event.target.value)} /></span></label>
      <label className="ad-f"><span>Recibido hasta</span><span className="ad-fi"><input type="date" aria-label="Recibido hasta" value={dates.to} onChange={event => changeDate('to', event.target.value)} /></span></label>
      <label className="ad-f"><span>Ordenar por</span><span className="ad-fi"><select aria-label="Ordenar por" value={applied.order} onChange={event => apply({ ...applied, order: event.target.value as Filters['order'] })}><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select></span></label>
      <div className="ad-factions">
        {anyFilter && <button className="ad-clean ad-pop" type="button" onClick={clearAll}><CloseIcon size={16} />Limpiar filtros</button>}
        <button className="ad-refresh" type="button" onClick={refresh} aria-label="Actualizar listado" disabled={loading}><RefreshIcon className={loading ? 'ad-spin' : undefined} size={18} />{loading ? 'Actualizando…' : 'Actualizar listado'}</button>
      </div>
      {invalidRange
        ? <p className="ad-fnote err" role="alert">La fecha hasta no puede ser anterior a la fecha desde.</p>
        : <p className="ad-fnote"><FilterIcon size={14} />Los filtros se aplican al instante. El rango incluye ambos días, según la fecha de recepción.</p>}
    </section>

    <section className="ad-otbl ad-st" style={{ animationDelay: '.32s' }} aria-busy={loading}>
      {loading ? <div className="ad-state" role="status"><SpinnerIcon className="ad-spin" size={28} />Cargando pedidos…</div>
        : error ? <div className="ad-state" role="alert"><p>{error}</p><button className="ad-btn-dark" type="button" onClick={() => setReload(value => value + 1)}><RefreshIcon size={17} />Reintentar listado</button></div>
        : !result?.pedidos.length ? <div className="ad-pop ad-state">
          <svg className="ad-swing2" width="80" height="74" viewBox="0 0 76 70" aria-hidden="true"><path d="M38 2 a6 6 0 1 1 6 6 c-3 0-6 2-6 6 v4" fill="none" stroke="#9DB3BE" strokeWidth="3" strokeLinecap="round" /><path d="M38 18 L4 46 H72 Z" fill="none" stroke="#9DB3BE" strokeWidth="3" strokeLinejoin="round" /></svg>
          <p className="ad-disp">{result && result.total > 0 ? 'Esta página no tiene pedidos.' : hasFilters ? 'No hay pedidos que coincidan con los filtros.' : 'Todavía no hay pedidos registrados.'}</p>
          {hasFilters && <p>Prueba con otro estado o amplía el rango de fechas.</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {hasFilters && <button className="ad-btn-dark" type="button" onClick={clearAll}>Ver todos los pedidos</button>}
            {page > 1 && <button className="ad-btn-dark" type="button" onClick={() => changePage(1)}>Volver a la primera página</button>}
          </div>
        </div>
        : <div aria-label="Listado de pedidos">
          <div className="ad-ohead" aria-hidden="true"><span>Pedido</span><span>Cliente</span><span>Estado</span><span>Recibido</span><span>Entrega estimada</span><span style={{ textAlign: 'right' }}>Total</span><span><span className="ad-sr">Acciones</span></span></div>
          {result.pedidos.map((order, index) => {
            const code = orderCode(order.id)
            const name = `${order.cliente.nombre} ${order.cliente.apellido}`.trim()
            const ini = initials(name)
            const [abg, afg] = avatarColors(ini)
            const due = calendarDay(order.fecha_entrega_estimada)
            let dueSub = '', dueColor = '#0A2433', dueWeight = 400
            if (!due) { dueColor = '#9A6A00'; dueWeight = 600; dueSub = 'Sin fecha' }
            else if (isActiveOrder(order)) {
              const days = daysBetween(today, due)
              if (days < 0) { dueColor = '#C8401F'; dueWeight = 600; dueSub = `Vencido hace ${-days} ${days === -1 ? 'día' : 'días'}` }
              else if (days === 0) { dueColor = '#06709F'; dueWeight = 600; dueSub = 'Hoy' }
              else { dueSub = days === 1 ? 'Mañana' : `En ${days} días`; dueColor = days <= 3 ? '#06709F' : '#0A2433' }
            }
            return <Link key={order.id} className="ad-orow" to={`${detailBase}/${order.id}`} aria-label={`Ver pedido ${code.slice(1)}`} style={{ animationDelay: `${(0.03 * index + 0.02).toFixed(2)}s` }}>
              <span className="ad-disp ad-oid">{code}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}><span className="ad-oav" style={{ background: abg, color: afg }}>{ini}</span><span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600 }}>{name}</span><span style={{ fontSize: 13, color: '#5A7280' }}>{order.cliente.telefono}</span></span></span>
              <span><StatusChip status={order.estado_actual} /></span>
              <span>{formatShortDate(order.fecha_recibido)}</span>
              <span><span style={{ display: 'block', color: dueColor, fontWeight: dueWeight }}>{due ? formatShortDate(order.fecha_entrega_estimada) : 'Por definir'}</span><span style={{ fontSize: 12, color: dueColor, opacity: .85 }}>{dueSub}</span></span>
              <span className="ad-disp" style={{ textAlign: 'right', fontWeight: 800, fontSize: 17 }}>{money(order.total)}</span>
              <span className="ad-ogo"><ChevronRightIcon size={18} strokeWidth={2.4} /></span>
            </Link>
          })}
        </div>}
      {!loading && !error && result && result.total > 0 && <footer className="ad-tfoot">
        <span aria-live="polite">{result.pedidos.length ? `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, result.total)} de ${result.total} pedidos` : `${result.total} pedidos encontrados`}{result.pedidos.length > 0 && <> · Suma <strong style={{ color: '#0A2433' }}>{money(result.pedidos.reduce((sum, order) => sum + order.total, 0))}</strong></>}</span>
        <Pager page={page} pages={totalPages} label={`Página ${page} de ${totalPages}`} onChange={changePage} nameSuffix=" de pedidos" />
      </footer>}
    </section>
  </section>
}
