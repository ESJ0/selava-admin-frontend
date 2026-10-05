import { ChevronLeft, ChevronRight, Eye, ListFilter, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { listOrders, listOrderStatuses } from '../api/orders'
import type { EstadoPedido, PedidoListFilters, PedidoListResponse } from '../types'

const pageSize = 20
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const date = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeZone: 'America/Guatemala' })
const emptyFilters = { search: '', status: '', from: '', to: '', order: 'recientes' as const }

function readFilters(params: URLSearchParams) {
  return {
    search: params.get('q') ?? '', status: params.get('estado_id') ?? '',
    from: params.get('fecha_desde') ?? '', to: params.get('fecha_hasta') ?? '',
    order: params.get('orden') === 'antiguos' ? 'antiguos' as const : 'recientes' as const,
  }
}

export function OrdersList({ detailBase }: { detailBase: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.toString()
  const applied = useMemo(() => readFilters(new URLSearchParams(query)), [query])
  const rawPage = Number(searchParams.get('pagina') ?? 1)
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1
  const [draft, setDraft] = useState({ query, filters: applied, validation: '' })
  const filters = draft.query === query ? draft.filters : applied
  const validation = draft.query === query ? draft.validation : ''
  const [result, setResult] = useState<PedidoListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [statuses, setStatuses] = useState<EstadoPedido[]>([])
  const [statusError, setStatusError] = useState('')
  const [statusReload, setStatusReload] = useState(0)

  function setFilters(value: typeof applied) {
    setDraft(current => ({ query, filters: value, validation: current.query === query ? current.validation : '' }))
  }

  function setValidation(value: string) {
    setDraft(current => ({ query, filters: current.query === query ? current.filters : applied, validation: value }))
  }

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatusError('')
      void listOrderStatuses(controller.signal).then(data => {
        if (!controller.signal.aborted) setStatuses(data)
      }).catch(error => {
        if (!controller.signal.aborted) setStatusError(errorMessage(error))
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
      }).catch(error => {
        if (!controller.signal.aborted) setError(errorMessage(error))
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [applied, page, reload])

  function apply(event: FormEvent) {
    event.preventDefault()
    if (filters.from && filters.to && filters.from > filters.to) {
      setValidation('La fecha hasta no puede ser anterior a la fecha desde.')
      return
    }
    setValidation('')
    const params = new URLSearchParams()
    if (filters.search.trim()) params.set('q', filters.search.trim())
    if (filters.status) params.set('estado_id', filters.status)
    if (filters.from) params.set('fecha_desde', filters.from)
    if (filters.to) params.set('fecha_hasta', filters.to)
    if (filters.order === 'antiguos') params.set('orden', filters.order)
    if (params.toString() === query) setReload(value => value + 1)
    else setSearchParams(params)
  }

  function changePage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next > 1) params.set('pagina', String(next))
    else params.delete('pagina')
    setSearchParams(params)
  }

  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize))
  const hasFilters = Boolean(applied.search || applied.status || applied.from || applied.to)

  return <section className="orders-list" aria-labelledby="orders-list-title">
    <header className="orders-list-heading">
      <div><h2 id="orders-list-title">Todos los pedidos</h2><p>Consulta los pedidos en proceso, entregados y cancelados.</p></div>
      <button className="secondary" type="button" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={17} aria-hidden="true"/>Actualizar listado</button>
    </header>
    <form className="orders-filters" onSubmit={apply} aria-label="Filtros de pedidos">
      <label className="orders-filter-search">Buscar pedido o cliente<input type="search" value={filters.search} maxLength={100} placeholder="Número, nombre o teléfono" onChange={event => setFilters({ ...filters, search: event.target.value })}/></label>
      <label>Estado del pedido<select aria-label="Estado del pedido" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
        <option value="">Todos los estados</option>
        {filters.status && !statuses.some(status => String(status.id) === filters.status) && <option value={filters.status}>Estado seleccionado</option>}
        {statuses.map(status => <option key={status.id} value={status.id}>{status.nombre}</option>)}
      </select></label>
      <label>Recibido desde<input type="date" value={filters.from} onChange={event => { setFilters({ ...filters, from: event.target.value }); setValidation('') }}/></label>
      <label>Recibido hasta<input type="date" value={filters.to} onChange={event => { setFilters({ ...filters, to: event.target.value }); setValidation('') }}/></label>
      <label>Ordenar por<select aria-label="Ordenar por" value={filters.order} onChange={event => setFilters({ ...filters, order: event.target.value as typeof filters.order })}><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select></label>
      <div className="orders-filter-actions"><span><ListFilter size={16} aria-hidden="true"/>El rango incluye ambos días, según la fecha de recepción.</span><div>
        <button className="secondary" type="button" onClick={() => { setFilters(emptyFilters); setValidation(''); setSearchParams(new URLSearchParams()); if (!query) setReload(value => value + 1) }}>Limpiar filtros</button>
        <button className="primary" type="submit"><Search size={17} aria-hidden="true"/>Aplicar filtros</button>
      </div></div>
      {validation && <div className="alert error orders-filter-message" role="alert">{validation}</div>}
      {statusError && <div className="alert error orders-filter-message" role="alert"><span>No se pudieron cargar los estados. {statusError}</span><button type="button" onClick={() => setStatusReload(value => value + 1)}>Reintentar estados</button></div>}
    </form>
    <div className="orders-list-card" aria-busy={loading}>
      {loading ? <div className="state" role="status"><span className="spinner"/>Cargando pedidos…</div>
        : error ? <div className="state" role="alert"><p>{error}</p><button className="secondary" type="button" onClick={() => setReload(value => value + 1)}>Reintentar listado</button></div>
        : !result?.pedidos.length ? <div className="state"><Search size={32} aria-hidden="true"/><p>{result && result.total > 0 ? 'Esta página no tiene pedidos.' : hasFilters ? 'No hay pedidos que coincidan con los filtros.' : 'Todavía no hay pedidos registrados.'}</p>{hasFilters && <button className="secondary" type="button" onClick={() => setSearchParams(new URLSearchParams())}>Ver todos los pedidos</button>}{page > 1 && <button className="secondary" type="button" onClick={() => changePage(1)}>Volver a la primera página</button>}</div>
        : <div className="table-scroll"><table className="orders-table"><caption className="sr-only">Listado de pedidos</caption><thead><tr><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col">Estado</th><th scope="col">Recibido</th><th scope="col">Entrega estimada</th><th scope="col">Total</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead><tbody>{result.pedidos.map(order => {
          const code = `SLV-${String(order.id).padStart(4, '0')}`
          const stateName = order.estado_actual.nombre.toLocaleLowerCase('es-GT')
          return <tr key={order.id}>
            <td data-label="Pedido"><strong>#{code}</strong></td>
            <td data-label="Cliente"><span className="orders-client"><b>{order.cliente.nombre} {order.cliente.apellido}</b><small>{order.cliente.telefono}</small></span></td>
            <td data-label="Estado"><span className={`order-list-state ${!order.activo || stateName === 'cancelado' ? 'cancelled' : stateName === 'entregado' ? 'completed' : ''}`}>{order.estado_actual.nombre}</span></td>
            <td data-label="Recibido">{date.format(new Date(order.fecha_recibido))}</td>
            <td data-label="Entrega estimada">{order.fecha_entrega_estimada ? date.format(new Date(order.fecha_entrega_estimada)) : 'Por definir'}</td>
            <td data-label="Total" className="money">{money.format(order.total)}</td>
            <td data-label="Detalle"><Link className="orders-view-link" to={`${detailBase}/${order.id}`} aria-label={`Ver pedido ${code}`}>Ver pedido<Eye size={17} aria-hidden="true"/></Link></td>
          </tr>
        })}</tbody></table></div>}
      {!loading && !error && result && result.total > 0 && <footer className="orders-pagination">
        <span aria-live="polite">{result.pedidos.length ? `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, result.total)} de ${result.total} pedidos` : `${result.total} pedidos encontrados`}</span>
        <div><button type="button" aria-label="Página anterior de pedidos" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={18}/></button><span>Página {page} de {totalPages}</span><button type="button" aria-label="Página siguiente de pedidos" disabled={page >= totalPages} onClick={() => changePage(page + 1)}><ChevronRight size={18}/></button></div>
      </footer>}
    </div>
  </section>
}
