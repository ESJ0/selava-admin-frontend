import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, PackageCheck, ReceiptText, Shirt, UserRound, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cancelOrder, getOrder, getOrderHistory, listOrderStatuses, updateOrderStatus } from '../api/orders'
import { errorMessage } from '../api/client'
import { Modal } from '../components/Modal'
import { OrderTimeline } from '../components/OrderTimeline'
import { useAuth } from '../store/auth'
import type { EstadoPedido, HistorialEstado, PedidoDetalle } from '../types'

const date = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' })
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const stateClass = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')

export function OrderDetailPage({ operatorMode = false }: { operatorMode?: boolean }) {
  const rawId = useParams().pedidoId
  const orderId = Number(rawId)
  const validOrderId = Number.isInteger(orderId) && orderId > 0
  const roleId = useAuth(state => state.roleId)
  const [order, setOrder] = useState<PedidoDetalle | null>(null)
  const [history, setHistory] = useState<HistorialEstado[]>([])
  const [statuses, setStatuses] = useState<EstadoPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [observations, setObservations] = useState('')

  const load = useCallback(async () => {
    try {
      const [detail, timeline, catalog] = await Promise.all([getOrder(orderId), getOrderHistory(orderId), listOrderStatuses()])
      setOrder(detail); setHistory(timeline); setStatuses(catalog); setError('')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }, [orderId])

  useEffect(() => {
    if (!validOrderId) return
    void Promise.all([getOrder(orderId), getOrderHistory(orderId), listOrderStatuses()])
      .then(([detail, timeline, catalog]) => { setOrder(detail); setHistory(timeline); setStatuses(catalog); setError('') })
      .catch(cause => setError(errorMessage(cause)))
      .finally(() => setLoading(false))
  }, [orderId, validOrderId])

  const availableStatuses = useMemo(() => statuses.filter(status => status.nombre !== 'Cancelado' && status.orden > (order?.estado_actual.orden ?? 0)), [order, statuses])
  const canCancel = roleId !== 3 && order?.estado_actual.nombre === 'Recibido'
  const showOperatorFlow = operatorMode || roleId === 3
  const paid = order?.pagos.reduce((total, payment) => total + payment.monto, 0) ?? 0

  async function confirmCancellation() {
    if (!order) return
    setSubmitting(true); setError('')
    try { await cancelOrder(order.id); setCancelOpen(false); setNotice('El pedido fue cancelado correctamente.'); await load() }
    catch (cause) { setError(errorMessage(cause)); setCancelOpen(false) }
    finally { setSubmitting(false) }
  }

  async function changeStatus() {
    const statusId = Number(nextStatus)
    if (!order || !statusId) { setError('Selecciona el nuevo estado del pedido.'); return }
    setSubmitting(true); setError(''); setNotice('')
    try {
      await updateOrderStatus(order.id, statusId, observations)
      setNotice('El estado del pedido se actualizó correctamente.'); setNextStatus(''); setObservations('')
      await load()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSubmitting(false) }
  }

  if (!validOrderId) return <section className="order-page"><Link className="back-link" to="/pedidos"><ArrowLeft size={18}/>Volver a pedidos</Link><div className="empty-card"><AlertTriangle size={36}/><h1>Número de pedido inválido</h1><p>Ingresa un número de pedido mayor que cero.</p></div></section>
  if (loading) return <div className="state page-state"><span className="spinner"/>Cargando pedido…</div>
  if (!order) return <section className="order-page"><Link className="back-link" to="/pedidos"><ArrowLeft size={18}/>Volver a pedidos</Link><div className="empty-card"><AlertTriangle size={36}/><h1>No pudimos abrir el pedido</h1><p>{error || 'El pedido solicitado no existe.'}</p></div></section>

  return <section className="order-detail-page">
    <Link className="back-link" to="/pedidos"><ArrowLeft size={18}/>Volver a pedidos</Link>
    <header className="order-detail-heading">
      <div><span className="eyebrow">Pedido</span><h1>#SLV-{String(order.id).padStart(4, '0')}</h1><p>Recibido el {date.format(new Date(order.fecha_recibido))}</p></div>
      <div className="heading-actions"><span className={`status-badge ${stateClass(order.estado_actual.nombre)}`}>{order.estado_actual.nombre}</span>{roleId !== 3 && <button className="danger-button" disabled={!canCancel} title={!canCancel ? 'Solo se puede cancelar un pedido en estado Recibido' : undefined} onClick={() => setCancelOpen(true)}><XCircle size={18}/>Cancelar pedido</button>}</div>
    </header>

    {notice && <div className="alert success"><CheckCircle2 size={19}/>{notice}</div>}
    {error && <div className="alert error"><AlertTriangle size={19}/>{error}</div>}

    <div className="order-detail-grid">
      <div className="order-main-column">
        <section className="detail-card client-card"><header><UserRound size={20}/><h2>Cliente</h2></header><div className="client-detail"><span className="avatar">{order.cliente.nombre[0]}{order.cliente.apellido[0]}</span><div><strong>{order.cliente.nombre} {order.cliente.apellido}</strong><span>{order.cliente.telefono}{order.cliente.email ? ` · ${order.cliente.email}` : ''}</span>{order.cliente.direccion && <small>{order.cliente.direccion}</small>}</div></div></section>

        <section className="detail-card"><header><Shirt size={20}/><h2>Prendas y servicios</h2><span className="count-pill">{order.prendas.reduce((sum, garment) => sum + garment.cantidad, 0)} prendas</span></header>
          <div className="garment-detail-list">{order.prendas.map(garment => <article key={garment.id}>
            <div className="garment-title"><span className="garment-icon"><Shirt size={20}/></span><div><strong>{garment.tipo_prenda?.nombre ?? `Prenda ${garment.id}`} × {garment.cantidad}</strong><small>{[garment.color, garment.descripcion].filter(Boolean).join(' · ') || 'Sin observaciones'}</small></div></div>
            <div className="service-detail-list">{garment.servicios.length ? garment.servicios.map(item => <div key={item.id}><span>{item.servicio?.nombre ?? `Servicio ${item.servicio_id}`}</span><b>{money.format(item.precio_aplicado * garment.cantidad)}</b></div>) : <span className="muted">Sin servicios asociados</span>}</div>
          </article>)}</div>
          <footer className="detail-total"><span>Total del pedido</span><strong>{money.format(order.total)}</strong></footer>
        </section>

        {order.observaciones && <section className="detail-card"><header><ReceiptText size={20}/><h2>Observaciones</h2></header><p className="order-observations">{order.observaciones}</p></section>}
      </div>

      <aside className="order-side-column">
        {showOperatorFlow && <section className="detail-card state-update-card"><header><PackageCheck size={20}/><h2>Actualizar estado</h2></header>{availableStatuses.length ? <><p>Avanza el pedido al siguiente punto del proceso.</p><label>Nuevo estado<select aria-label="Nuevo estado" value={nextStatus} onChange={event => setNextStatus(event.target.value)}><option value="">Seleccionar estado</option>{availableStatuses.map(status => <option key={status.id} value={status.id}>{status.nombre}</option>)}</select></label><label>Observaciones<textarea value={observations} onChange={event => setObservations(event.target.value)} maxLength={500} placeholder="Agrega una nota opcional…"/></label><button className="primary wide" disabled={submitting} onClick={() => void changeStatus()}>{submitting ? 'Actualizando…' : 'Actualizar estado'}</button></> : <div className="completed-state"><CheckCircle2 size={25}/><span>Este pedido ya no tiene estados pendientes.</span></div>}</section>}

        <section className="detail-card"><header><CalendarDays size={20}/><h2>Historial</h2></header><OrderTimeline history={history}/></section>
        <section className="detail-card payment-summary"><header><ReceiptText size={20}/><h2>Pagos</h2></header><div><span>Pagado</span><b>{money.format(paid)}</b></div><div><span>Saldo pendiente</span><strong>{money.format(Math.max(order.total - paid, 0))}</strong></div></section>
      </aside>
    </div>

    {cancelOpen && <Modal title="Cancelar pedido" onClose={() => !submitting && setCancelOpen(false)}><div className="confirm-modal"><span className="warning-icon"><AlertTriangle size={30}/></span><p>¿Estás seguro de cancelar el pedido <b>#SLV-{String(order.id).padStart(4, '0')}</b>? Esta acción cambiará su estado y no podrá deshacerse desde esta pantalla.</p><footer><button className="secondary" disabled={submitting} onClick={() => setCancelOpen(false)}>Volver</button><button className="danger-button solid" disabled={submitting} onClick={() => void confirmCancellation()}>{submitting ? 'Cancelando…' : 'Sí, cancelar pedido'}</button></footer></div></Modal>}
  </section>
}
