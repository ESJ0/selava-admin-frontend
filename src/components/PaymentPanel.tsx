import { AlertTriangle, CheckCircle2, CreditCard, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { errorMessage, httpStatus } from '../api/client'
import { getOrderBalance, getOrderPayments, listPaymentMethods, registerOrderPayment } from '../api/payments'
import type { MetodoPago, PagoDetalle, SaldoPedido } from '../types'

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const dateTime = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' })

function paymentError(cause: unknown) {
  const message = errorMessage(cause)
  if (httpStatus(cause) === 409 && /excede|supera|saldo/i.test(message)) {
    return 'El monto ingresado supera el saldo pendiente.'
  }
  return message
}

export function PaymentPanel({ orderId, onPaymentSaved }: { orderId: number; onPaymentSaved: () => Promise<boolean> }) {
  const [balance, setBalance] = useState<SaldoPedido | null>(null)
  const [payments, setPayments] = useState<PagoDetalle[]>([])
  const [methods, setMethods] = useState<MetodoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [reference, setReference] = useState('')
  const request = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const [nextBalance, nextPayments, nextMethods] = await Promise.all([
        getOrderBalance(orderId, controller.signal),
        getOrderPayments(orderId, controller.signal),
        listPaymentMethods(controller.signal),
      ])
      if (controller.signal.aborted) return false
      setBalance(nextBalance)
      setPayments(nextPayments ?? [])
      setMethods((nextMethods ?? []).filter((method) => method.activo))
      return true
    } catch (cause) {
      if (!controller.signal.aborted) {
        setBalance(null)
        setPayments([])
        setMethods([])
        setError(errorMessage(cause))
      }
      return false
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const numericAmount = Number(amount)
    const numericMethod = Number(methodId)
    if (!methodId || !Number.isInteger(numericMethod) || numericMethod <= 0) {
      setError('Selecciona un método de pago.')
      return
    }
    if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('El monto debe ser mayor que cero.')
      return
    }
    if (balance && numericAmount > balance.saldo_pendiente) {
      setError('El monto ingresado supera el saldo pendiente.')
      return
    }
    setSaving(true)
    try {
      await registerOrderPayment(orderId, {
        metodo_pago_id: numericMethod,
        monto: numericAmount,
        ...(reference.trim() && { referencia: reference.trim() }),
      })
      setAmount('')
      setMethodId('')
      setReference('')
      setNotice('Pago registrado correctamente.')
      await Promise.all([load(), onPaymentSaved()])
    } catch (cause) {
      setError(paymentError(cause))
    } finally {
      setSaving(false)
    }
  }

  return <section className="detail-card payment-panel">
    <header><CreditCard size={20}/><h2>Cobro y pagos</h2></header>
    {loading ? <div className="state compact" role="status"><span className="spinner"/>Cargando saldo e historial…</div> : error && !balance ? <div className="payment-content"><div className="alert error" role="alert"><AlertTriangle size={19}/><span>{error}</span></div><button className="secondary wide" onClick={() => void load()}><RefreshCw size={17}/>Reintentar</button></div> : <div className="payment-content">
      {balance && <div className="balance-grid" aria-label="Resumen de saldo">
        <span>Total<strong>{money.format(balance.total)}</strong></span>
        <span>Pagado<strong>{money.format(balance.total_pagado)}</strong></span>
        <span>Saldo pendiente<strong>{money.format(balance.saldo_pendiente)}</strong></span>
      </div>}

      {notice && <div className="alert success" role="status"><CheckCircle2 size={18}/>{notice}</div>}
      {error && <div className="alert error" role="alert"><AlertTriangle size={18}/>{error}</div>}

      {balance && balance.saldo_pendiente > 0 && <form className="payment-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Monto *<input aria-label="Monto" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>Método de pago *<select aria-label="Método de pago" value={methodId} onChange={(event) => setMethodId(event.target.value)} required><option value="">Seleccionar método</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.nombre}</option>)}</select></label>
        </div>
        <label>Referencia<input aria-label="Referencia" value={reference} maxLength={100} onChange={(event) => setReference(event.target.value)} placeholder="Opcional" /></label>
        <button className="primary wide" disabled={saving}>{saving ? 'Registrando…' : 'Registrar pago'}</button>
      </form>}
      {balance?.saldo_pendiente === 0 && <div className="paid-state"><CheckCircle2 size={20}/>Pedido pagado en su totalidad.</div>}

      <div className="payment-history">
        <h3>Historial de pagos</h3>
        {!payments.length ? <p className="empty-block">Sin pagos registrados.</p> : payments.map((payment) => <article key={payment.id}>
          <div><strong>{payment.metodo_pago.nombre}</strong><small>{dateTime.format(new Date(payment.fecha_pago))}</small><small>{payment.usuario ? `${payment.usuario.nombre} ${payment.usuario.apellido}` : `Usuario #${payment.usuario_id}`}{payment.referencia ? ` · ${payment.referencia}` : ''}</small></div>
          <b>{money.format(payment.monto)}</b>
        </article>)}
      </div>
    </div>}
  </section>
}
