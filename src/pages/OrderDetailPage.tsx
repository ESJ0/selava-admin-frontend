import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, PackageCheck, ReceiptText, Shirt, UserRound, XCircle } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cancelOrder, updateOrderStatus } from '../api/orders'
import { errorMessage, httpStatus } from '../api/client'
import { Modal } from '../components/Modal'
import { OrderTimeline } from '../components/OrderTimeline'
import { useAuth } from '../store/auth'
import { useOrderData } from '../hooks/useOrderData'

const date = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' })
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const stateClass = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')

export function OrderDetailPage({ operatorMode = false }: { operatorMode?: boolean }) {
  const rawId = useParams().pedidoId
  const orderId = Number(rawId)
  const validOrderId = Number.isInteger(orderId) && orderId > 0
  if (!validOrderId) return <section className="order-page"><Link className="back-link" to="/pedidos"><ArrowLeft size={18}/>Volver a pedidos</Link><div className="empty-card"><AlertTriangle size={36}/><h1>Número de pedido inválido</h1><p>Ingresa un número de pedido mayor que cero.</p></div></section>
  return <OrderDetailContent key={orderId} orderId={orderId} operatorMode={operatorMode} />
}

function OrderDetailContent({ orderId, operatorMode }: { orderId: number; operatorMode: boolean }) {
  const roleId = useAuth(state => state.roleId)
  const { order, history, statuses, loading, error, setError, notFound, load, isActive } = useOrderData(orderId)
  const [notice, setNotice] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [observations, setObservations] = useState('')
  const busy = useRef(false)

  const availableStatuses = useMemo(() => !order || ['Entregado', 'Cancelado'].includes(order.estado_actual.nombre) ? [] : statuses.filter(status => status.nombre !== 'Cancelado' && status.orden > order.estado_actual.orden), [order, statuses])
  const canManage = roleId === 1 || roleId === 2
  const canCancel = canManage && order?.estado_actual.nombre === 'Recibido' && !submitting
  const showOperatorFlow = operatorMode || roleId === 3
  const paid = order?.pagos.reduce((total, payment) => total + payment.monto, 0) ?? 0

  async function mutate(action: () => Promise<unknown>, message: string) {
    if (busy.current) return
    busy.current = true
    setSubmitting(true); setError(''); setNotice('')
    try {
      await action()
      if (!isActive()) return
      setCancelOpen(false); setNextStatus(''); setObservations('')
      const refreshed = await load()
      if (isActive()) setNotice(refreshed ? message : 'El cambio se guardó, pero no pudimos recargar el pedido. Intenta cargarlo nuevamente.')
    } catch (cause) {
      if (isActive()) {
        if (httpStatus(cause) === 409) { await load(); setNextStatus('') }
        if (isActive()) { setError(errorMessage(cause)); setCancelOpen(false) }
      }
    } finally {
      busy.current = false
      if (isActive()) setSubmitting(false)
    }
  }

  async function confirmCancellation() {
    if (!order || !canCancel) return
    await mutate(() => cancelOrder(order.id), 'El pedido fue cancelado correctamente.')
  }

  async function changeStatus() {
    const statusId = Number(nextStatus)
    if (!order || !availableStatuses.some(status => status.id === statusId)) {
      setError('Selecciona un estado disponible para este pedido.'); return
    }
    if (new TextEncoder().encode(observations.trim()).length > 255) {
      setError('Las observaciones son demasiado largas. Acórtalas antes de continuar.'); return
    }
    await mutate(() => updateOrderStatus(order.id, statusId, observations), 'El estado del pedido se actualizó correctamente.')
  }

  if (loading) return <div className="state page-state" role="status"><span className="spinner"/>Cargando pedido…</div>
  if (!order) return <section className="order-page"><Link className="back-link" to="/pedidos"><ArrowLeft size={18}/>Volver a pedidos</Link><div className="empty-card"><AlertTriangle size={36}/><h1>{notFound ? 'Pedido no encontrado' : 'No pudimos abrir el pedido'}</h1>{notice && <p role="status">{notice}</p>}<p role="alert">{error || 'El pedido solicitado no existe.'}</p><button className="primary" onClick={() => void load()}>Volver a cargar</button></div></section>

  return <section className="order-detail-page">
    <Link className="back-link" to="/pedidos"><ArrowLeft size={18}/>Volver a pedidos</Link>
    <header className="order-detail-heading">
      <div><span className="eyebrow">Pedido</span><h1>#SLV-{String(order.id).padStart(4, '0')}</h1><p>Recibido el {date.format(new Date(order.fecha_recibido))}</p></div>
      <div className="heading-actions"><span className={`status-badge ${stateClass(order.estado_actual.nombre)}`}>{order.estado_actual.nombre}</span>{canManage && <button className="danger-button" disabled={!canCancel} title={!canCancel ? 'Solo se puede cancelar un pedido en estado Recibido' : undefined} onClick={() => setCancelOpen(true)}><XCircle size={18}/>Cancelar pedido</button>}</div>
    </header>

    {notice && <div className="alert success" role="status"><CheckCircle2 size={19}/>{notice}</div>}
    {error && <div className="alert error" role="alert"><AlertTriangle size={19}/>{error}</div>}

    <div className="order-detail-grid">
      <div className="order-main-column">
        <section className="detail-card client-card"><header><UserRound size={20}/><h2>Cliente</h2></header><div className="client-detail"><span className="avatar">{order.cliente.nombre[0]}{order.cliente.apellido[0]}</span><div><strong>{order.cliente.nombre} {order.cliente.apellido}</strong><span>{order.cliente.telefono}{order.cliente.email ? ` · ${order.cliente.email}` : ''}</span>{order.cliente.direccion && <small>{order.cliente.direccion}</small>}</div></div></section>

        <section className="detail-card"><header><Shirt size={20}/><h2>Prendas y servicios</h2><span className="count-pill">{order.prendas.reduce((sum, garment) => sum + garment.cantidad, 0)} prendas</span></header>
          {!order.prendas.length && <p className="empty-block">Este pedido no tiene prendas registradas.</p>}
          <div className="garment-detail-list">{order.prendas.map(garment => <article key={garment.id}>
            <div className="garment-title"><span className="garment-icon"><Shirt size={20}/></span><div><strong>{garment.tipo_prenda?.nombre ?? `Prenda ${garment.id}`} × {garment.cantidad}</strong><small>{[garment.color, garment.descripcion].filter(Boolean).join(' · ') || 'Sin observaciones'}</small></div></div>
            <div className="service-detail-list">{garment.servicios.length ? garment.servicios.map(item => <div key={item.id}><span>{item.servicio?.nombre ?? `Servicio ${item.servicio_id}`}<small className="unit-price">{money.format(item.precio_aplicado)} por unidad × {garment.cantidad}</small></span><b>{money.format(item.precio_aplicado * garment.cantidad)}</b></div>) : <span className="muted">Sin servicios asociados</span>}</div>
          </article>)}</div>
          <footer className="detail-total"><span>Total del pedido</span><strong>{money.format(order.total)}</strong></footer>
        </section>

        {order.observaciones && <section className="detail-card"><header><ReceiptText size={20}/><h2>Observaciones</h2></header><p className="order-observations">{order.observaciones}</p></section>}
      </div>

      <aside className="order-side-column">
        {showOperatorFlow && <section className="detail-card state-update-card"><header><PackageCheck size={20}/><h2>Actualizar estado</h2></header>{availableStatuses.length ? <><p>Avanza el pedido al siguiente punto del proceso.</p><label>Nuevo estado<select aria-label="Nuevo estado" disabled={submitting} value={nextStatus} onChange={event => setNextStatus(event.target.value)}><option value="">Seleccionar estado</option>{availableStatuses.map(status => <option key={status.id} value={status.id}>{status.nombre}</option>)}</select></label><label>Observaciones<textarea value={observations} onChange={event => setObservations(event.target.value)} maxLength={255} placeholder="Agrega una nota opcional…"/></label><button className="primary wide" disabled={submitting || !nextStatus} onClick={() => void changeStatus()}>{submitting ? 'Actualizando…' : 'Actualizar estado'}</button></> : <div className="completed-state"><CheckCircle2 size={25}/><span>Este pedido ya no tiene estados pendientes.</span></div>}</section>}

        <section className="detail-card"><header><CalendarDays size={20}/><h2>Historial</h2></header><OrderTimeline history={history}/></section>
        <section className="detail-card payment-summary"><header><ReceiptText size={20}/><h2>Pagos</h2></header>{order.pagos.map(payment => <div key={payment.id}><span>{payment.metodo_pago.nombre}<small className="unit-price">{date.format(new Date(payment.fecha_pago))}{payment.referencia ? ` · ${payment.referencia}` : ''}</small></span><b>{money.format(payment.monto)}</b></div>)}{!order.pagos.length && <p className="empty-block">Sin pagos registrados.</p>}<div><span>Pagado</span><b>{money.format(paid)}</b></div><div><span>Saldo pendiente</span><strong>{money.format(Math.max(order.total - paid, 0))}</strong></div></section>
      </aside>
    </div>

    {cancelOpen && <Modal title="Cancelar pedido" onClose={() => !submitting && setCancelOpen(false)}><div className="confirm-modal"><span className="warning-icon"><AlertTriangle size={30}/></span><p>¿Estás seguro de cancelar el pedido <b>#SLV-{String(order.id).padStart(4, '0')}</b>? Esta acción cambiará su estado y no podrá deshacerse desde esta pantalla.</p><footer><button className="secondary" disabled={submitting} onClick={() => setCancelOpen(false)}>Volver</button><button className="danger-button solid" disabled={submitting} onClick={() => void confirmCancellation()}>{submitting ? 'Cancelando…' : 'Sí, cancelar pedido'}</button></footer></div></Modal>}
  </section>
}
