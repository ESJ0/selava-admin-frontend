import { CreditCard, ReceiptText } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PagoDetalle } from '../types'

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const dateTime = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' })

interface PaymentHistoryProps {
  orderId: number
  payments: PagoDetalle[]
  total: number
  canRegister?: boolean
}

export function PaymentHistory({ orderId, payments, total, canRegister = false }: PaymentHistoryProps) {
  const paid = payments.reduce((sum, payment) => sum + payment.monto, 0)
  const outstanding = Math.max(total - paid, 0)

  return <section className="detail-card payment-history">
    <header>
      <ReceiptText size={20}/>
      <h2>Historial de pagos</h2>
      <span className="count-pill">{payments.length} {payments.length === 1 ? 'pago' : 'pagos'}</span>
      {canRegister && outstanding > 0 && <Link className="payment-link" to={`/pedidos/${orderId}/cobrar`}><CreditCard size={16}/>Registrar pago</Link>}
    </header>

    {payments.length ? <ol className="payment-list">{payments.map(payment => <li key={payment.id}>
      <span className="payment-method-icon"><CreditCard size={18}/></span>
      <div className="payment-entry">
        <div><strong>{payment.metodo_pago.nombre}</strong><b>{money.format(payment.monto)}</b></div>
        <time dateTime={payment.fecha_pago}>{dateTime.format(new Date(payment.fecha_pago))}</time>
        {(payment.referencia || payment.usuario) && <small>{[
          payment.referencia && `Ref. ${payment.referencia}`,
          payment.usuario && `Registrado por ${payment.usuario.nombre} ${payment.usuario.apellido}`,
        ].filter(Boolean).join(' · ')}</small>}
      </div>
    </li>)}</ol> : <div className="empty-block"><ReceiptText size={22}/><span>Este pedido todavía no tiene pagos registrados.</span></div>}

    <footer className="payment-totals">
      <div><span>Pagado</span><b>{money.format(paid)}</b></div>
      <div><span>Saldo pendiente</span><strong>{money.format(outstanding)}</strong></div>
    </footer>
  </section>
}
