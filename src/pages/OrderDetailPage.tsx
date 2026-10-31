import { useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cancelOrder, updateOrderStatus } from '../api/orders'
import { errorMessage, httpStatus } from '../api/client'
import { ConfirmDialog } from '../components/admin/AdminBits'
import { useToast } from '../hooks/useToast'
import { AlertIcon, ArrowLeftIcon, ClockIcon, MailIcon, NoteIcon, PathIcon, PhoneIcon, ShirtIcon, SpinnerIcon, TagIcon, UserIcon, XCircleIcon } from '../components/admin/icons'
import { OrderProgressTimeline } from '../components/OrderProgressTimeline'
import { OrderStateControl } from '../components/OrderStateControl'
import { OrderTimeline } from '../components/OrderTimeline'
import { PaymentPanel } from '../components/PaymentPanel'
import { PromotionBreakdown } from '../components/PromotionBreakdown'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import { useAuth } from '../store/auth'
import { useOrderData } from '../hooks/useOrderData'
import type { FlujoOperativoPedido, PrendaDetalle } from '../types'
import { chargeSubtotal } from '../utils/chargePricing'
import { calendarDay, colorSwatch, serviceIconPath, daysBetween, formatMeasure, formatPhone, formatShortDate, garmentIconPath, initials, money, orderCode, stageLook, startOfDay, unitName, unitPer } from '../utils/adminFormat'

const chargeMode = (garment: PrendaDetalle) => garment.modalidad_cobro_aplicada ?? 'UNIDAD'

/** Estado de un servicio según la etapa del flujo que lo aplica. */
function serviceProgress(flow: FlujoOperativoPedido, serviceId: number) {
  if (flow.cancelado) return null
  const stage = flow.estados.find(item => item.servicios.some(service => service.id === serviceId))
  if (!stage) return null
  if (stage.actual) return { cls: ' now', text: 'En proceso' }
  if (stage.completado) return { cls: ' done', text: 'Hecho' }
  return { cls: '', text: 'Pendiente' }
}

export function OrderDetailPage({ operatorMode = false }: { operatorMode?: boolean }) {
  const rawId = useParams().pedidoId
  const orderId = Number(rawId)
  const validOrderId = Number.isInteger(orderId) && orderId > 0
  if (!validOrderId) return <section><Link className="ad-bk" to="/pedidos"><span className="ba"><ArrowLeftIcon size={18} /></span>Volver a pedidos</Link><div className="ad-card" style={{ marginTop: 16 }}><div className="ad-state"><AlertIcon size={36} /><h1 className="ad-disp" style={{ margin: 0, fontSize: 26 }}>Número de pedido inválido</h1><p>Ingresa un número de pedido mayor que cero.</p></div></div></section>
  return <OrderDetailContent key={orderId} orderId={orderId} operatorMode={operatorMode} />
}

function OrderDetailContent({ orderId, operatorMode }: { orderId: number; operatorMode: boolean }) {
  const roleId = useAuth(state => state.roleId)
  const { order, history, loading, error, setError, notFound, load, refresh, isActive } = useOrderData(orderId)
  const [notice, setNotice] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [observations, setObservations] = useState('')
  const busy = useRef(false)
  const toast = useToast()
  const invalidateOverview = useOrdersOverview(state => state.load)

  const canManage = roleId === 1 || roleId === 2
  const canCancel = canManage && order?.estado_actual.nombre === 'Recibido' && !submitting
  const showProgress = operatorMode || roleId === 1 || roleId === 2 || roleId === 3

  async function mutate(action: () => Promise<unknown>, message: string) {
    if (busy.current) return
    busy.current = true
    setSubmitting(true); setError(''); setNotice('')
    try {
      await action()
      if (!isActive()) return
      setCancelOpen(false); setObservations('')
      const refreshed = await load()
      void invalidateOverview(true)
      if (isActive()) {
        const text = refreshed ? message : 'El cambio se guardó, pero no pudimos recargar el pedido. Intenta cargarlo nuevamente.'
        setNotice(text)
        toast.show(text, !refreshed)
      }
    } catch (cause) {
      if (isActive()) {
        if (httpStatus(cause) === 409) await load()
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
    const next = order?.flujo_operativo.siguiente_estado
    if (!order || !next) { setError('Este pedido no tiene una siguiente etapa disponible.'); return }
    if (new TextEncoder().encode(observations.trim()).length > 255) { setError('Las observaciones son demasiado largas. Acórtalas antes de continuar.'); return }
    await mutate(() => updateOrderStatus(order.id, next.id, observations), 'El estado del pedido se actualizó correctamente.')
  }

  if (loading) return <div className="ad-card"><div className="ad-state" role="status"><SpinnerIcon className="ad-spin" size={28} />Cargando pedido…</div></div>
  if (!order) return <section>
    <Link className="ad-bk" to="/pedidos"><span className="ba"><ArrowLeftIcon size={18} /></span>Volver a pedidos</Link>
    <div className="ad-card ad-pop" style={{ marginTop: 16 }}><div className="ad-state">
      <AlertIcon size={36} />
      <h1 className="ad-disp" style={{ margin: 0, fontSize: 26 }}>{notFound ? 'Pedido no encontrado' : 'No pudimos abrir el pedido'}</h1>
      {notice && <p role="status">{notice}</p>}
      <p role="alert">{error || 'El pedido solicitado no existe.'}</p>
      <button className="ad-btn-dark" type="button" onClick={() => void load()}>Volver a cargar</button>
    </div></div>
  </section>

  const flow = order.flujo_operativo
  const cancelled = flow.cancelado
  const finished = flow.estados.length > 0 && !flow.siguiente_estado && !cancelled
  const chip = cancelled ? '#F08A63' : finished || stageLook(order.estado_actual)[1] === '#1F8A5B' ? '#7EE0B5' : '#FFC93C'
  const due = calendarDay(order.fecha_entrega_estimada)
  const dueDays = due ? daysBetween(startOfDay(), due) : null
  const name = `${order.cliente.nombre} ${order.cliente.apellido}`.trim()
  const pct = Math.min(100, Math.max(0, Math.round(flow.progreso_porcentaje)))

  return <section>
    <Link className="ad-bk ad-st" to="/pedidos"><span className="ba"><ArrowLeftIcon size={18} /></span>Volver a pedidos</Link>

    <section className={`ad-dhero ad-st${cancelled ? ' cancelled' : ''}`} aria-labelledby="order-title">
      <span className="ad-bub" aria-hidden="true" style={{ right: '8%', bottom: -30, width: 24, height: 24 }} />
      <span className="ad-bub" aria-hidden="true" style={{ right: '34%', bottom: -30, width: 14, height: 14, animationDelay: '3s' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, position: 'relative' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5BC3EC' }}>Pedido</p>
          <h1 id="order-title" className="ad-disp">{orderCode(order.id)}</h1>
          <p style={{ margin: '10px 0 0', color: '#A9C1CD' }}>Recibido el {formatShortDate(order.fecha_recibido)} · {due ? <>Entrega estimada {formatShortDate(order.fecha_entrega_estimada)}{dueDays !== null && !cancelled && flow.siguiente_estado && <span style={{ color: dueDays < 0 ? '#F7A787' : '#FFC93C' }}> · {dueDays < 0 ? `vencida hace ${-dueDays} ${dueDays === -1 ? 'día' : 'días'}` : dueDays === 0 ? 'hoy' : dueDays === 1 ? 'mañana' : `faltan ${dueDays} días`}</span>}</> : 'Entrega por definir'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {flow.estados.length > 0 && <div className="ad-ring" style={{ '--p': pct } as CSSProperties} role="img" aria-label={`Avance ${pct}%`}><span className="ad-disp">{pct}%</span></div>}
          <span className="ad-hchip" style={{ background: chip }} role="status" aria-label={`Estado: ${order.estado_actual.nombre}`}><i />{order.estado_actual.nombre}</span>
          {canManage && !cancelled && <button className="ad-cancelb" type="button" disabled={!canCancel} title={!canCancel ? 'Solo se puede cancelar un pedido en estado Recibido' : undefined} onClick={() => setCancelOpen(true)}><XCircleIcon size={18} />Cancelar pedido</button>}
        </div>
      </div>
      {showProgress && flow.estados.length > 0 && <OrderProgressTimeline flow={flow} />}
      {flow.estados.length === 0 && <p style={{ margin: '28px 0 0', padding: '14px 18px', borderRadius: 16, background: '#123A50', color: '#C9D8E0' }}>Este pedido no cuenta con el desglose de etapas del flujo operativo.</p>}
    </section>

    {error && <div className="ad-banner err" role="alert"><AlertIcon size={19} />{error}</div>}

    <div className="ad-dcols">
      <div className="ad-dcol">
        <section className="ad-card ad-st" style={{ animationDelay: '.2s' }} aria-labelledby="client-title">
          <div className="ad-hd2"><span className="ad-hi"><UserIcon size={20} /></span><h2 id="client-title">Cliente</h2></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span className="ad-bigav">{initials(name)}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p className="ad-disp" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</p>
              <p style={{ margin: '4px 0 0', color: '#3E5866' }}>{formatPhone(order.cliente.telefono)}{order.cliente.email ? ` · ${order.cliente.email}` : ''}</p>
              {order.cliente.direccion && <p style={{ margin: '2px 0 0', fontSize: 14, color: '#5A7280' }}>{order.cliente.direccion}</p>}
            </div>
            <a className="ad-pill2" href={`tel:${order.cliente.telefono.replace(/[^\d+]/g, '')}`}><PhoneIcon size={16} />Llamar</a>
            {order.cliente.email && <a className="ad-pill2" href={`mailto:${order.cliente.email}`}><MailIcon size={16} />Correo</a>}
          </div>
        </section>

        <section className="ad-card ad-st" style={{ animationDelay: '.26s', paddingBottom: 0, overflow: 'hidden' }} aria-labelledby="garments-title">
          <div className="ad-hd2"><span className="ad-hi"><ShirtIcon size={20} /></span><h2 id="garments-title">Prendas y servicios</h2><span className="ad-cnt2">{order.prendas.length} {order.prendas.length === 1 ? 'registro' : 'registros'}</span></div>
          {order.observaciones && <div className="ad-obsn" style={{ marginTop: 0, marginBottom: 14 }}><NoteIcon size={16} /><span><strong>Observaciones del pedido:</strong> {order.observaciones}</span></div>}
          {!order.prendas.length && <p className="ad-muted" style={{ margin: '0 0 8px' }}>Este pedido no tiene prendas registradas.</p>}
          <div className="ad-gitems">
            {order.prendas.map(garment => {
              const mode = chargeMode(garment)
              const typeName = garment.tipo_prenda?.nombre ?? `Prenda ${garment.id}`
              return <article className="ad-gitem" key={garment.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span className="ad-gic"><PathIcon d={garmentIconPath(typeName, mode)} size={26} strokeWidth={1.8} /></span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <h3 className="ad-disp">{typeName}</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 14, color: '#5A7280' }}>{formatMeasure(garment.cantidad)} {unitName(mode, garment.cantidad)}</p>
                  </div>
                  {garment.color && <span className="ad-swc"><span style={{ background: colorSwatch(garment.color) }} />{garment.color}</span>}
                </div>
                {garment.descripcion && <div className="ad-obsn"><NoteIcon size={16} /><span><strong>Observación:</strong> {garment.descripcion}</span></div>}
                {garment.precio_aplicado != null && <div className="ad-prow">
                  <span><span style={{ display: 'block', fontWeight: 600 }}>Precio aplicado</span><span style={{ fontSize: 13, color: '#5A7280' }}>{formatMeasure(garment.cantidad)} {unitName(mode, garment.cantidad)} × {money(garment.precio_aplicado)} {unitPer(mode)}</span></span>
                  <strong className="ad-disp" style={{ fontSize: 20 }}>{money(chargeSubtotal(garment.precio_aplicado, garment.cantidad))}</strong>
                </div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  {garment.servicios.length ? garment.servicios.map(item => {
                    const progress = serviceProgress(flow, item.servicio_id)
                    const serviceName = item.servicio?.nombre ?? `Servicio ${item.servicio_id}`
                    return <span key={item.id} className={`ad-svcp${progress?.cls ?? ''}`}>
                      <PathIcon d={serviceIconPath(serviceName)} size={16} strokeWidth={2} />{serviceName}
                      {garment.precio_aplicado == null && <span style={{ fontWeight: 500 }}>· {money(item.precio_aplicado)} por unidad × {garment.cantidad} = {money(item.precio_aplicado * garment.cantidad)}</span>}
                      {progress && <em>{progress.text}</em>}
                    </span>
                  }) : <span className="ad-muted">Sin servicios asociados</span>}
                </div>
              </article>
            })}
          </div>
          {!!order.promociones_aplicadas?.length && <section aria-labelledby="order-promos-title" style={{ marginTop: 18 }}>
            <div className="ad-hd2" style={{ marginBottom: 4 }}><span className="ad-hi" style={{ background: '#FFF4D6', color: '#9A6A00' }}><TagIcon size={20} /></span><h2 id="order-promos-title">Promociones aplicadas</h2></div>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: '#5A7280' }}>Los importes de las prendas son las tarifas normales; este desglose conserva las promociones guardadas al crear el pedido.</p>
            {order.promociones_aplicadas.map(promotion => <PromotionBreakdown key={promotion.promocion_id} promotion={promotion} />)}
          </section>}
          <div className="ad-totbar"><span>Total del pedido</span><strong className="ad-disp">{money(order.total)}</strong></div>
        </section>

        <section className="ad-card ad-st" style={{ animationDelay: '.32s' }} aria-labelledby="history-title">
          <div className="ad-hd2"><span className="ad-hi"><ClockIcon size={20} /></span><h2 id="history-title">Historial</h2><span className="ad-cnt2">{history.length} {history.length === 1 ? 'cambio' : 'cambios'}</span></div>
          <OrderTimeline history={history} />
        </section>
      </div>

      <div className="ad-dcol">
        {canManage && <OrderStateControl flow={flow} currentLabel={order.estado_actual.nombre} observations={observations} submitting={submitting} onObservationsChange={setObservations} onAdvance={() => void changeStatus()} />}
        {canManage && <PaymentPanel orderId={order.id} onPaymentSaved={refresh} />}
        {!canManage && <section className="ad-card"><p className="ad-muted" style={{ margin: 0 }}>Consulta el avance del pedido. Los cambios de estado y los pagos los gestiona recepción.</p></section>}
      </div>
    </div>

    {cancelOpen && <ConfirmDialog title={`¿Cancelar pedido ${orderCode(order.id)}?`} icon={<XCircleIcon size={30} />} confirmLabel="Sí, cancelar pedido" busyLabel="Cancelando…" cancelLabel="Mantener pedido" busy={submitting} onClose={() => setCancelOpen(false)} onConfirm={() => void confirmCancellation()}>
      <p style={{ margin: 0 }}>El pedido dejará de avanzar en la planta. No se eliminará: quedará en estado Cancelado junto con su historial como constancia.</p>
    </ConfirmDialog>}
    {toast.node}
  </section>
}
