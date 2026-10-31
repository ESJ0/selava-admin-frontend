import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deactivateClient, getClient, updateClient } from '../api/clients'
import { errorMessage } from '../api/client'
import { ClientForm } from '../components/ClientForm'
import { ConfirmDialog, StatusChip } from '../components/admin/AdminBits'
import { useToast } from '../hooks/useToast'
import { ArrowLeftIcon, ChevronRightIcon, ClipboardIcon, EditIcon, MailIcon, PhoneIcon, PlusIcon, PowerIcon, RefreshIcon, SpinnerIcon, UserIcon } from '../components/admin/icons'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import type { Cliente } from '../types'
import { formatPhone, formatShortDate, initials, money, orderCode } from '../utils/adminFormat'

const registeredDate = new Intl.DateTimeFormat('es-GT', { dateStyle: 'long' })

export function ClientDetailPage() {
  const { clientId } = useParams()
  const id = Number(clientId)
  const [client, setClient] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const request = useRef<AbortController | null>(null)
  const toast = useToast()
  const orders = useOrdersOverview((state) => state.orders)
  const ordersStatus = useOrdersOverview((state) => state.status)
  const loadOrders = useOrdersOverview((state) => state.load)

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setError('El cliente solicitado no es válido.')
      setLoading(false)
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await getClient(id, controller.signal)
      if (!controller.signal.aborted) setClient(response)
    } catch (cause) {
      if (!controller.signal.aborted) { setClient(null); setError(errorMessage(cause)) }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])
  useEffect(() => { void loadOrders() }, [loadOrders])

  const clientOrders = useMemo(() => orders.filter((order) => order.cliente.id === id), [orders, id])

  async function setActive(active: boolean) {
    if (!client) return
    setSavingStatus(true)
    setError('')
    try {
      if (!active) {
        await deactivateClient(client.id)
        setClient({ ...client, activo: false })
        toast.show('Cliente desactivado correctamente.')
      } else {
        const updated = await updateClient(client.id, { activo: true })
        setClient(updated)
        toast.show('Cliente activado correctamente.')
      }
      setConfirmOff(false)
    } catch (cause) {
      setError(errorMessage(cause))
      setConfirmOff(false)
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) return <div className="ad-card"><div className="ad-state" role="status"><SpinnerIcon className="ad-spin" size={28} />Cargando cliente…</div></div>
  if (!client) return <section>
    <Link className="ad-bk" to="/clientes"><span className="ba"><ArrowLeftIcon size={18} /></span>Volver a clientes</Link>
    <div className="ad-card ad-pop" style={{ marginTop: 16 }}><div className="ad-state" role="alert"><UserIcon size={40} /><h1 className="ad-disp" style={{ margin: 0, fontSize: 26 }}>No fue posible cargar el cliente.</h1><p>{error || 'El cliente solicitado no existe.'}</p><button className="ad-btn-dark" type="button" onClick={() => void load()}><RefreshIcon size={17} />Reintentar</button></div></div>
  </section>

  const name = `${client.nombre} ${client.apellido}`.trim()
  const spent = clientOrders.reduce((sum, order) => sum + order.total, 0)

  return <section>
    <Link className="ad-bk ad-st" to="/clientes"><span className="ba"><ArrowLeftIcon size={18} /></span>Volver a clientes</Link>

    <header className="ad-client-hero ad-st" style={{ animationDelay: '.08s' }}>
      <span className="ad-bub" aria-hidden="true" style={{ right: '8%', bottom: -30, width: 24, height: 24 }} />
      <span className="ad-bigav" style={{ width: 84, height: 84, borderRadius: 24, fontSize: 30 }}>{initials(name)}</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5BC3EC' }}>Cliente #{client.id}</p>
        <h1 className="ad-disp">{name}</h1>
        <span className={`ad-stb ${client.activo ? 'on' : 'off'}`} style={{ marginTop: 10 }}><i />{client.activo ? 'Activo' : 'Inactivo'}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
        <button className="ad-quote" type="button" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }} onClick={() => setEditing(true)}><EditIcon size={17} />Editar cliente</button>
        <button className={client.activo ? 'ad-cancelb' : 'ad-advb'} style={client.activo ? undefined : { width: 'auto', height: 42, marginTop: 0, padding: '0 16px', fontSize: 14, gap: 8 }} type="button" disabled={savingStatus} onClick={() => client.activo ? setConfirmOff(true) : void setActive(true)}>
          <PowerIcon size={17} />{savingStatus ? 'Guardando…' : client.activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </header>

    {error && <div className="ad-banner err" role="alert">{error}</div>}

    <div className="ad-dcols">
      <section className="ad-card ad-st" style={{ animationDelay: '.16s' }} aria-labelledby="client-info-title">
        <div className="ad-hd2"><span className="ad-hi"><UserIcon /></span><h2 id="client-info-title">Información del cliente</h2></div>
        <dl className="ad-info" style={{ margin: 0 }}>
          <div><dt>Teléfono</dt><dd>{client.telefono}</dd></div>
          <div><dt>Correo electrónico</dt><dd>{client.email || 'No registrado'}</dd></div>
          <div><dt>Dirección</dt><dd>{client.direccion || 'No registrada'}</dd></div>
          <div><dt>NIT</dt><dd title={client.nit ? undefined : 'NIT no disponible en la API actual'}>{client.nit || '—'}</dd></div>
          <div className="ad-span2"><dt>Fecha de registro</dt><dd>{registeredDate.format(new Date(client.created_at))}</dd></div>
        </dl>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <a className="ad-pill2" href={`tel:${client.telefono.replace(/[^\d+]/g, '')}`}><PhoneIcon size={16} />Llamar al {formatPhone(client.telefono)}</a>
          {client.email && <a className="ad-pill2" href={`mailto:${client.email}`}><MailIcon size={16} />Correo</a>}
        </div>
      </section>

      <section className="ad-card ad-st" style={{ animationDelay: '.22s' }} aria-labelledby="client-orders-title">
        <div className="ad-hd2"><span className="ad-hi"><ClipboardIcon /></span><h2 id="client-orders-title">Pedidos</h2><span className="ad-cnt2">{clientOrders.length} · {money(spent)}</span></div>
        {ordersStatus === 'error' ? <p className="ad-muted">No pudimos cargar los pedidos de este cliente.</p>
          : ordersStatus !== 'ready' && !orders.length ? <p className="ad-muted" role="status">Cargando pedidos…</p>
          : clientOrders.length === 0 ? <p className="ad-muted">Este cliente aún no tiene pedidos.</p>
          : <div style={{ display: 'flex', flexDirection: 'column' }}>
            {clientOrders.slice(0, 8).map((order) => <Link key={order.id} className="ad-up" to={`/pedidos/${order.id}`} style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto', textDecoration: 'none', color: '#0A2433' }}>
              <span><b className="ad-disp" style={{ fontSize: 16 }}>{orderCode(order.id)}</b><small style={{ display: 'block', color: '#5A7280' }}>Recibido {formatShortDate(order.fecha_recibido)} · {money(order.total)}</small></span>
              <StatusChip status={order.estado_actual} />
              <ChevronRightIcon size={18} />
            </Link>)}
          </div>}
        {client.activo && <Link className="ad-ghostl" to="/pedidos/nuevo" style={{ marginTop: 14 }}><PlusIcon size={16} strokeWidth={2.4} />Nuevo pedido</Link>}
      </section>
    </div>

    {editing && <ClientForm client={client} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast.show('Cliente actualizado correctamente.'); void load() }} />}
    {confirmOff && <ConfirmDialog title={`¿Desactivar a ${name}?`} confirmLabel="Sí, desactivar" busyLabel="Desactivando…" cancelLabel="Mantener activo" busy={savingStatus} icon={<PowerIcon size={30} />} onClose={() => setConfirmOff(false)} onConfirm={() => void setActive(false)}>
      <p style={{ margin: 0 }}>El cliente dejará de aparecer al crear pedidos. Podrás activarlo de nuevo cuando quieras.</p>
    </ConfirmDialog>}
    {toast.node}
  </section>
}
