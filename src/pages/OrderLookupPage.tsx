import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { OrdersList } from '../components/OrdersList'
import { StatusChip } from '../components/admin/AdminBits'
import { ArrowRightIcon } from '../components/admin/icons'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import { useAuth } from '../store/auth'
import { money, orderCode } from '../utils/adminFormat'

export function OrderLookupPage() {
  const [orderId, setOrderId] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const roleId = useAuth(state => state.roleId)
  const orders = useOrdersOverview(state => state.orders)
  const loadOrders = useOrdersOverview(state => state.load)
  const base = roleId === 3 ? '/operario/pedidos' : '/pedidos'

  useEffect(() => { void loadOrders() }, [loadOrders])

  const id = Number(orderId)
  const hit = orderId ? orders.find(order => order.id === id) : undefined

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!Number.isInteger(id) || id <= 0) {
      setError('Ingresa un número de pedido válido.')
      return
    }
    navigate(`${base}/${id}`)
  }

  return <section>
    <section className="ad-aphead">
      <div>
        <p className="ad-st ad-kicker">Pedidos</p>
        <h1 className="ad-disp ad-st ad-h1 sm" style={{ animationDelay: '.06s' }}>{roleId === 3 ? 'Actualizar pedidos' : 'Consultar pedidos'}<em>.</em></h1>
        <p className="ad-st ad-lead" style={{ animationDelay: '.1s', fontSize: 17, marginTop: 12 }}>Consulta los pedidos en proceso, entregados y cancelados.</p>
      </div>
      <form className="ad-st" style={{ animationDelay: '.14s' }} onSubmit={submit}>
        <label htmlFor="lookup-order" style={{ display: 'block', margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#3E5866' }}>Abrir por número de comprobante</label>
        <div className="ad-cmd">
          <span className="pre" aria-hidden="true">#SLV-</span>
          <input id="lookup-order" aria-label="Número de pedido" type="text" inputMode="numeric" placeholder="0001" value={orderId} onChange={event => { setOrderId(event.target.value.replace(/\D/g, '').slice(0, 7)); setError('') }} />
          <button className="ad-go" type="submit">Abrir pedido<ArrowRightIcon size={18} /></button>
        </div>
        {error && <p className="ad-pop ad-miss" role="alert" style={{ marginTop: 8 }}>{error}</p>}
        {hit && !error && <p className="ad-pop" style={{ margin: '8px 0 0', fontSize: 14, color: '#3E5866', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ color: '#0A2433' }}>{orderCode(hit.id)} · {hit.cliente.nombre} {hit.cliente.apellido} · {money(hit.total)}</strong><StatusChip status={hit.estado_actual} />
        </p>}
      </form>
    </section>
    <OrdersList detailBase={base} />
  </section>
}
