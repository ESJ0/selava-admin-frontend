import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { deactivateClient, listClients, updateClient } from '../api/clients'
import { errorMessage } from '../api/client'
import { ClientForm } from '../components/ClientForm'
import { Pager } from '../components/admin/AdminBits'
import { useToast } from '../hooks/useToast'
import { ArrowRightIcon, CloseIcon, CopyIcon, GridIcon, ListIcon, PlusIcon, RefreshIcon, SearchIcon, SpinnerIcon } from '../components/admin/icons'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import type { Cliente } from '../types'
import { avatarColors, formatPhone, initials } from '../utils/adminFormat'

type StatusFilter = 'todos' | 'activo' | 'inactivo'
const PAGE_SIZE = 5
const tabs: { value: StatusFilter; label: string }[] = [{ value: 'todos', label: 'Todos' }, { value: 'activo', label: 'Activos' }, { value: 'inactivo', label: 'Inactivos' }]
const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` })

const fullName = (client: Cliente) => `${client.nombre} ${client.apellido}`.trim()
const duplicateKey = (client: Cliente) => `${fullName(client).toLocaleLowerCase('es-GT')}|${client.telefono.replace(/\D/g, '')}`

export function ClientsPage() {
  const [clients, setClients] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [freshId, setFreshId] = useState(0)
  const [copied, setCopied] = useState(0)
  const [toggling, setToggling] = useState(0)
  const copyTimer = useRef<number | undefined>(undefined)
  const request = useRef<AbortController | null>(null)
  const toast = useToast()
  const orders = useOrdersOverview((state) => state.orders)
  const ordersReady = useOrdersOverview((state) => state.status === 'ready')
  const loadOrders = useOrdersOverview((state) => state.load)

  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setLoadError(false)
    try {
      const response = await listClients(controller.signal)
      if (!controller.signal.aborted) setClients(response ?? [])
    } catch {
      if (!controller.signal.aborted) { setClients([]); setLoadError(true) }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])
  useEffect(() => { void loadOrders() }, [loadOrders])
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  // Conteo real de pedidos por cliente a partir del listado de pedidos.
  const orderCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const order of orders) counts.set(order.cliente.id, (counts.get(order.cliente.id) ?? 0) + 1)
    return counts
  }, [orders])

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>()
    for (const client of clients) seen.set(duplicateKey(client), (seen.get(duplicateKey(client)) ?? 0) + 1)
    return seen
  }, [clients])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-GT')
    const digits = term.replace(/\D/g, '')
    return clients.filter((client) => {
      if (status === 'activo' && !client.activo) return false
      if (status === 'inactivo' && client.activo) return false
      if (!term) return true
      const text = [client.nombre, client.apellido, client.telefono, client.email, client.nit].filter(Boolean).join(' ').toLocaleLowerCase('es-GT')
      return text.includes(term) || (digits.length >= 3 && client.telefono.replace(/\D/g, '').includes(digits))
    })
  }, [clients, search, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const activeCount = clients.filter((client) => client.activo).length
  const duplicateGroups = [...duplicates.values()].filter((count) => count > 1).length
  const statusIndex = tabs.findIndex((tab) => tab.value === status)

  function copyPhone(client: Cliente) {
    void navigator.clipboard?.writeText(client.telefono).catch(() => undefined)
    setCopied(client.id)
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(0), 1500)
  }

  async function toggleStatus(client: Cliente) {
    if (toggling) return
    setToggling(client.id)
    try {
      if (client.activo) await deactivateClient(client.id)
      else await updateClient(client.id, { activo: true })
      setClients((current) => current.map((item) => item.id === client.id ? { ...item, activo: !client.activo } : item))
      toast.show(client.activo ? 'Cliente desactivado correctamente.' : 'Cliente activado correctamente.')
    } catch (cause) {
      toast.show(errorMessage(cause), true)
    } finally {
      setToggling(0)
    }
  }

  const ordersText = (client: Cliente) => {
    if (ordersReady) return String(orderCounts.get(client.id) ?? 0)
    return client.pedidos_count === undefined ? '—' : String(client.pedidos_count)
  }

  const statusSwitch = (client: Cliente) => <button className="ad-sw" type="button" role="switch" aria-checked={client.activo} aria-label={`Estado de ${fullName(client)}`} disabled={toggling === client.id} onClick={() => void toggleStatus(client)}>
    <span className="ad-trk"><span className="ad-knb" /></span>
    <span>{toggling === client.id ? 'Guardando…' : client.activo ? 'Activo' : 'Inactivo'}</span>
  </button>

  const avatar = (client: Cliente, big = false) => {
    const text = initials(fullName(client))
    const [bg, fg] = avatarColors(text)
    return <span className={`ad-av${big ? ' big' : ''}`} style={{ background: bg, color: fg, position: 'relative' }}>
      {text}
      {client.tiene_alerta && <span title="Cliente con alerta activa" aria-label="Cliente con alerta activa" role="img" style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%', background: '#C8401F', border: '2px solid #fff' }} />}
    </span>
  }

  const badges = (client: Cliente) => <>
    {(duplicates.get(duplicateKey(client)) ?? 0) > 1 && <span className="ad-dupb" title="Mismo nombre y teléfono que otro cliente">Posible duplicado</span>}
    {client.id === freshId && <span className="ad-newb">Nuevo</span>}
  </>

  return <section aria-labelledby="clients-title">
    <section className="ad-headrow">
      <div>
        <p className="ad-st ad-kicker">Operación</p>
        <h1 id="clients-title" className="ad-disp ad-st ad-h1" style={delay(.06)}>Clientes<em>.</em></h1>
        <p className="ad-st ad-lead" style={delay(.12)}>Gestiona la información de tus clientes.</p>
      </div>
      <button className="ad-newc ad-st" type="button" style={delay(.18)} onClick={() => setCreateOpen(true)}>
        <span className="plus"><PlusIcon size={20} strokeWidth={2.6} /></span>Nuevo cliente
      </button>
    </section>

    <section className="ad-stats ad-st" style={delay(.22)} aria-label="Resumen de clientes">
      <div><p className="k">Clientes registrados</p><p className="v">{loading ? '–' : clients.length}</p></div>
      <div><p className="k">Activos</p><p className="v" style={{ color: '#1F8A5B' }}>{loading ? '–' : activeCount}</p></div>
      <div><p className="k">Inactivos</p><p className="v" style={{ color: '#5A7280' }}>{loading ? '–' : clients.length - activeCount}</p></div>
      <div className="warnbox"><p className="k">Posibles duplicados</p><p className="v" style={{ color: '#9A6A00' }}>{loading ? '–' : duplicateGroups}</p></div>
    </section>

    <section className="ad-tools ad-st" style={delay(.28)}>
      <label className="ad-srch">
        <SearchIcon size={20} stroke="#5A7280" />
        <span className="ad-sr">Buscar clientes</span>
        <input type="search" placeholder="Buscar por nombre, teléfono, correo o NIT…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        {search && <button className="ad-clr" type="button" onClick={() => { setSearch(''); setPage(1) }} aria-label="Limpiar búsqueda"><CloseIcon size={16} /></button>}
      </label>
      <div role="tablist" aria-label="Filtrar por estado" className="ad-segs">
        <span className="ad-spill" style={{ transform: `translateX(${statusIndex * 112}px)` }} aria-hidden="true" />
        {tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} onClick={() => { setStatus(tab.value); setPage(1) }}>{tab.label}</button>)}
      </div>
      <div className="ad-views" role="group" aria-label="Vista">
        <button type="button" aria-pressed={view === 'list'} aria-label="Vista de lista" onClick={() => setView('list')}><ListIcon size={18} /></button>
        <button type="button" aria-pressed={view === 'grid'} aria-label="Vista de tarjetas" onClick={() => setView('grid')}><GridIcon size={18} /></button>
      </div>
    </section>

    {loading ? <section className="ad-tbl ad-st" style={delay(.34)}><div className="ad-state" role="status"><SpinnerIcon className="ad-spin" size={28} />Cargando clientes…</div></section>
      : loadError ? <section className="ad-tbl ad-pop"><div className="ad-state" role="alert"><p className="ad-disp">No fue posible cargar los clientes.</p><button className="ad-btn-dark" type="button" onClick={() => void load()}><RefreshIcon size={17} />Reintentar</button></div></section>
      : clients.length === 0 ? <section className="ad-tbl ad-pop"><div className="ad-state"><p className="ad-disp">No hay clientes registrados.</p><p>Registra el primero con el botón “Nuevo cliente”.</p></div></section>
      : view === 'list' ? <section className="ad-tbl ad-st" style={delay(.34)} aria-label="Listado de clientes">
        <div className="ad-thead" aria-hidden="true"><span>Cliente</span><span>Teléfono</span><span>NIT</span><span>Pedidos</span><span>Estado</span><span /></div>
        {visible.map((client, index) => <div key={client.id} className={`ad-tr${client.id === freshId ? ' fresh' : ''}`} style={delay(0.36 + index * 0.05)}>
          <div className="ad-who">
            {avatar(client)}
            <div style={{ minWidth: 0 }}>
              <p className="ad-who-name">{fullName(client)}{badges(client)}</p>
              <p className="ad-who-mail">{client.email || 'Sin correo electrónico'}</p>
            </div>
          </div>
          <button className="ad-tel" type="button" onClick={() => copyPhone(client)} aria-label={`Copiar teléfono ${client.telefono}`}>
            {formatPhone(client.telefono)}
            {copied === client.id ? <span className="ad-okc">Copiado</span> : <CopyIcon className="cpy" size={14} />}
          </button>
          <span className="ad-muted" title={client.nit ? undefined : 'NIT no disponible en la API actual'}>{client.nit || '—'}</span>
          <span className="ad-muted">{ordersText(client)}</span>
          {statusSwitch(client)}
          <Link className="ad-ver" to={`/clientes/${client.id}`} aria-label="Ver">Ver<ArrowRightIcon size={16} /></Link>
        </div>)}
        {filtered.length === 0 && <div className="ad-pop ad-state"><p className="ad-disp">No se encontraron clientes.</p><p>Prueba con otro nombre, teléfono o correo.</p></div>}
        <footer className="ad-tfoot">
          <span>{filtered.length ? `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(filtered.length, currentPage * PAGE_SIZE)} de ${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'}` : '0 clientes'}</span>
          <Pager page={currentPage} pages={totalPages} label={`${currentPage} / ${totalPages}`} onChange={setPage} />
        </footer>
      </section>
      : <section className="ad-cgrid" aria-label="Tarjetas de clientes">
        {filtered.map((client, index) => <article key={client.id} className="ad-ccard" style={delay(Math.min(index, 12) * 0.04)}>
          <div className="ad-ccard-top">{avatar(client, true)}<span className={`ad-stb ${client.activo ? 'on' : 'off'}`}><i />{client.activo ? 'Activo' : 'Inactivo'}</span></div>
          <h3 className="ad-disp">{fullName(client)}</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#5A7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email || 'Sin correo electrónico'}</p>
          {(duplicates.get(duplicateKey(client)) ?? 0) > 1 && <span className="ad-dupb" style={{ marginTop: 10 }}>Posible duplicado</span>}
          <div className="ad-ccard-foot"><span style={{ fontWeight: 600 }}>{formatPhone(client.telefono)}</span><Link className="ad-ver" to={`/clientes/${client.id}`} aria-label="Ver">Ver<ArrowRightIcon size={16} /></Link></div>
        </article>)}
        {filtered.length === 0 && <div className="ad-pop ad-state ad-span2" style={{ gridColumn: '1 / -1' }}><p className="ad-disp">No se encontraron clientes.</p><p>Prueba con otro nombre, teléfono o correo.</p></div>}
      </section>}

    {createOpen && <ClientForm onClose={() => setCreateOpen(false)} onSaved={(saved) => {
      if (saved?.id) setFreshId(saved.id)
      setStatus('todos'); setSearch(''); setPage(1)
      toast.show('Cliente registrado correctamente.')
      void load()
      void loadOrders(true)
    }} />}
    {toast.node}
  </section>
}
