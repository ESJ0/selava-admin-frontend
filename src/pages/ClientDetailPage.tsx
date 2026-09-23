import { ArrowLeft, CalendarDays, Edit3, Mail, MapPin, Phone, Power, RefreshCw, ShoppingBag, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deactivateClient, getClient, updateClient } from '../api/clients'
import { errorMessage } from '../api/client'
import { ClientForm } from '../components/ClientForm'
import { Modal } from '../components/Modal'
import type { Cliente } from '../types'

const registeredDate = new Intl.DateTimeFormat('es-GT', { dateStyle: 'long' })

function initials(client: Cliente) {
  return `${client.nombre.charAt(0)}${client.apellido.charAt(0)}`.toLocaleUpperCase('es-GT')
}

export function ClientDetailPage() {
  const { clientId } = useParams()
  const id = Number(clientId)
  const [client, setClient] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)
  const request = useRef<AbortController | null>(null)

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

  async function toggleStatus() {
    if (!client) return
    if (client.activo && !confirm(`¿Desactivar a “${client.nombre} ${client.apellido}”?`)) return
    setSavingStatus(true)
    setError('')
    setSuccess('')
    try {
      if (client.activo) {
        await deactivateClient(client.id)
        setClient({ ...client, activo: false })
        setSuccess('Cliente desactivado correctamente.')
      } else {
        const updated = await updateClient(client.id, { activo: true })
        setClient(updated)
        setSuccess('Cliente activado correctamente.')
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) return <div className="state page-state" role="status"><span className="spinner"/>Cargando cliente…</div>
  if (!client) return <section className="empty-card"><UserRound size={48}/><h1>No fue posible cargar el cliente.</h1><p>{error || 'El cliente solicitado no existe.'}</p><button className="secondary" onClick={() => void load()}><RefreshCw size={17}/>Reintentar</button></section>

  return <section className="client-detail-page">
    <Link className="back-link" to="/clientes"><ArrowLeft size={18}/>Volver a clientes</Link>
    <header className="client-detail-heading">
      <div className="client-detail-title"><span className="client-detail-avatar">{initials(client)}</span><div><span className="eyebrow">Cliente #{client.id}</span><h1>{client.nombre} {client.apellido}</h1><span className={`client-status ${client.activo ? 'active' : ''}`}>{client.activo ? 'Activo' : 'Inactivo'}</span></div></div>
      <div className="heading-actions"><button className="secondary" onClick={() => { setSuccess(''); setEditing(true) }}><Edit3 size={17}/>Editar cliente</button><button className={client.activo ? 'danger-button' : 'primary'} disabled={savingStatus} onClick={() => void toggleStatus()}><Power size={17}/>{savingStatus ? 'Guardando…' : client.activo ? 'Desactivar' : 'Activar'}</button></div>
    </header>
    {success && <div className="alert success" role="status">{success}</div>}
    {error && <div className="alert error" role="alert">{error}</div>}

    <div className="client-detail-grid">
      <section className="detail-card client-information"><header><UserRound size={20}/><h2>Información del cliente</h2></header><div className="client-information-grid">
        <div><Phone/><span>Teléfono<strong>{client.telefono}</strong></span></div>
        <div><Mail/><span>Correo electrónico<strong>{client.email || 'No registrado'}</strong></span></div>
        <div><MapPin/><span>Dirección<strong>{client.direccion || 'No registrada'}</strong></span></div>
        <div><span className="detail-symbol">NIT</span><span>NIT<strong title={client.nit ? undefined : 'NIT no disponible en la API actual'}>{client.nit || '—'}</strong></span></div>
        <div><CalendarDays/><span>Fecha de registro<strong>{registeredDate.format(new Date(client.created_at))}</strong></span></div>
      </div></section>
      <section className="detail-card client-orders"><header><ShoppingBag size={20}/><h2>Pedidos</h2>{client.pedidos_count !== undefined && <span className="count-pill">{client.pedidos_count}</span>}</header><div className="empty-block"><ShoppingBag size={19}/><span>La consulta de pedidos por cliente aún no está disponible.</span></div></section>
    </div>

    {editing && <Modal title="Editar cliente" onClose={() => setEditing(false)}><ClientForm client={client} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setSuccess('Cliente actualizado correctamente.'); void load() }}/></Modal>}
  </section>
}
