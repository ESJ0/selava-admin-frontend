import { ChevronLeft, ChevronRight, Eye, Plus, RefreshCw, Search, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listClients } from '../api/clients'
import type { Cliente } from '../types'

type StatusFilter = 'todos' | 'activo' | 'inactivo'
const pageSize = 5

function initials(client: Cliente) {
  return `${client.nombre.charAt(0)}${client.apellido.charAt(0)}`.toLocaleUpperCase('es-GT')
}

export function ClientsPage() {
  const [clients, setClients] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [page, setPage] = useState(1)
  const request = useRef<AbortController | null>(null)

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
      if (!controller.signal.aborted) {
        setClients([])
        setLoadError(true)
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-GT')
    return clients.filter((client) => {
      if (status === 'activo' && !client.activo) return false
      if (status === 'inactivo' && client.activo) return false
      if (!term) return true
      return [client.nombre, client.apellido, client.telefono, client.email, client.nit]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es-GT')
        .includes(term)
    })
  }, [clients, search, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleClients = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateStatus(value: StatusFilter) {
    setStatus(value)
    setPage(1)
  }

  return <section className="clients-page">
    <header className="page-heading clients-heading">
      <div><h1>Clientes</h1><p>Gestiona la información de tus clientes.</p></div>
      <button className="primary client-create-button" type="button"><Plus size={19}/>Nuevo cliente</button>
    </header>

    <div className="clients-toolbar">
      <label className="clients-search"><Search size={21}/><span className="sr-only">Buscar clientes</span><input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Buscar por nombre, teléfono o NIT..." /></label>
      <div className="status-tabs" role="group" aria-label="Filtrar por estado">
        {(['todos', 'activo', 'inactivo'] as const).map((value) => <button key={value} type="button" className={status === value ? 'selected' : ''} aria-pressed={status === value} onClick={() => updateStatus(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}</button>)}
      </div>
    </div>

    <section className="clients-card">
      {loading ? <div className="state clients-state" role="status"><span className="spinner"/>Cargando clientes…</div>
        : loadError ? <div className="state clients-state" role="alert"><UserRound size={40}/><b>No fue posible cargar los clientes.</b><button className="secondary" onClick={() => void load()}><RefreshCw size={17}/>Reintentar</button></div>
          : clients.length === 0 ? <div className="state clients-state"><UserRound size={40}/><b>No hay clientes registrados.</b></div>
            : filtered.length === 0 ? <div className="state clients-state"><Search size={40}/><b>No se encontraron clientes.</b></div>
              : <div className="table-scroll"><table className="clients-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>NIT</th><th>Pedidos</th><th>Estado</th><th aria-label="Acción"/></tr></thead><tbody>{visibleClients.map((client) => <tr key={client.id}>
                <td data-label="Cliente"><div className="client-identity"><span className="client-avatar">{initials(client)}{client.tiene_alerta && <span className="client-alert-dot" title="Cliente con alerta activa" aria-label="Cliente con alerta activa"/>}</span><span><b>{client.nombre} {client.apellido}</b><small>{client.email || 'Sin correo electrónico'}</small></span></div></td>
                <td data-label="Teléfono">{client.telefono}</td>
                <td data-label="NIT" title={client.nit ? undefined : 'NIT no disponible en la API actual'}>{client.nit || '—'}</td>
                <td data-label="Pedidos" title={client.pedidos_count === undefined ? 'Conteo no disponible en la API actual' : undefined}>{client.pedidos_count ?? '—'}</td>
                <td data-label="Estado"><span className={`client-status ${client.activo ? 'active' : ''}`}>{client.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td data-label="Acción"><Link className="client-view-link" to={`/clientes/${client.id}`}><Eye size={17}/>Ver</Link></td>
              </tr>)}</tbody></table></div>}
      {!loading && !loadError && clients.length > 0 && <footer className="clients-pagination"><span>{filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}</span><div><button type="button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={18}/></button><span>{currentPage} / {totalPages}</span><button type="button" aria-label="Página siguiente" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight size={18}/></button></div></footer>}
    </section>
  </section>
}
