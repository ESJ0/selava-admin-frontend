import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, CreditCard, ReceiptText } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { getOrderBalance, listActivePaymentMethods, registerPayment } from '../api/payments'
import type { MetodoPago, SaldoPedido } from '../types'

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })

export function PaymentPage() {
  const rawId = useParams().pedidoId
  const orderId = Number(rawId)
  const validOrderId = Number.isInteger(orderId) && orderId > 0

  if (!validOrderId) {
    return <section className="payment-page"><Link className="back-link" to="/pedidos"><ArrowLeft size={18}/>Volver a pedidos</Link><div className="empty-card"><AlertTriangle size={36}/><h1>Número de pedido inválido</h1><p>Ingresa un número de pedido mayor que cero.</p></div></section>
  }

  return <PaymentContent key={orderId} orderId={orderId}/>
}

function PaymentContent({ orderId }: { orderId: number }) {
  const [balance, setBalance] = useState<SaldoPedido | null>(null)
  const [methods, setMethods] = useState<MetodoPago[]>([])
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    Promise.all([getOrderBalance(orderId, controller.signal), listActivePaymentMethods(controller.signal)])
      .then(([nextBalance, nextMethods]) => {
        if (controller.signal.aborted) return
        setBalance(nextBalance)
        setMethods(nextMethods)
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(errorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      mounted.current = false
      controller.abort()
    }
  }, [orderId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!balance || submitting) return

    const selectedMethod = Number(methodId)
    const numericAmount = Number(amount)
    setError('')
    setNotice('')

    if (!methods.some(method => method.id === selectedMethod)) {
      setError('Selecciona un método de pago disponible.')
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Ingresa un monto mayor que cero.')
      return
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError('El monto puede tener como máximo dos decimales.')
      return
    }
    if (numericAmount > balance.saldo_pendiente) {
      setError(`El monto no puede superar el saldo pendiente de ${money.format(balance.saldo_pendiente)}.`)
      return
    }
    if (new TextEncoder().encode(reference.trim()).length > 100) {
      setError('La referencia es demasiado larga. Usa un máximo de 100 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const payment = await registerPayment(orderId, selectedMethod, numericAmount, reference)
      if (!mounted.current) return
      setBalance(current => current && ({
        ...current,
        total_pagado: current.total_pagado + payment.monto,
        saldo_pendiente: Math.max(current.saldo_pendiente - payment.monto, 0),
      }))
      setAmount('')
      setReference('')
      setNotice(`Pago de ${money.format(payment.monto)} registrado correctamente.`)
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause))
    } finally {
      if (mounted.current) setSubmitting(false)
    }
  }

  if (loading) return <div className="state page-state" role="status"><span className="spinner"/>Cargando información de cobro…</div>
  if (!balance) return <section className="payment-page"><Link className="back-link" to={`/pedidos/${orderId}`}><ArrowLeft size={18}/>Volver al pedido</Link><div className="empty-card"><AlertTriangle size={36}/><h1>No pudimos abrir el cobro</h1><p role="alert">{error || 'El pedido solicitado no existe.'}</p></div></section>

  const paidInFull = balance.saldo_pendiente <= 0

  return <section className="payment-page">
    <Link className="back-link" to={`/pedidos/${orderId}`}><ArrowLeft size={18}/>Volver al pedido</Link>
    <header className="page-heading payment-heading"><div><span className="eyebrow">Registrar pago</span><h1>Cobrar pedido #SLV-{String(orderId).padStart(4, '0')}</h1><p>Registra un abono o completa el pago pendiente.</p></div></header>

    {notice && <div className="alert success" role="status"><CheckCircle2 size={19}/>{notice}</div>}
    {error && <div className="alert error" role="alert"><AlertTriangle size={19}/>{error}</div>}

    <div className="payment-layout">
      <aside className="balance-card" aria-label="Resumen del saldo">
        <span className="balance-icon"><ReceiptText size={28}/></span>
        <p>Saldo pendiente</p>
        <strong>{money.format(balance.saldo_pendiente)}</strong>
        <dl><div><dt>Total del pedido</dt><dd>{money.format(balance.total)}</dd></div><div><dt>Pagado</dt><dd>{money.format(balance.total_pagado)}</dd></div></dl>
      </aside>

      <section className="detail-card payment-form-card">
        <header><CreditCard size={20}/><h2>Datos del pago</h2></header>
        {paidInFull ? <div className="paid-in-full"><CheckCircle2 size={36}/><h2>Pedido pagado</h2><p>Este pedido no tiene saldo pendiente.</p><Link className="primary" to={`/pedidos/${orderId}`}>Ver detalle del pedido</Link></div> : <form noValidate onSubmit={submit}>
          <label>Método de pago<select aria-label="Método de pago" value={methodId} onChange={event => setMethodId(event.target.value)} disabled={submitting} required><option value="">Seleccionar método</option>{methods.map(method => <option key={method.id} value={method.id}>{method.nombre}</option>)}</select></label>
          <label>Monto<span className="money-input"><b>Q</b><input aria-label="Monto" type="number" inputMode="decimal" min="0.01" max={balance.saldo_pendiente} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" disabled={submitting} required/></span></label>
          <button className="amount-shortcut" type="button" disabled={submitting} onClick={() => setAmount(balance.saldo_pendiente.toFixed(2))}><Banknote size={17}/>Usar saldo completo: {money.format(balance.saldo_pendiente)}</button>
          <label>Referencia <small>Opcional</small><input aria-label="Referencia" value={reference} onChange={event => setReference(event.target.value)} maxLength={100} placeholder="Número de autorización o comprobante" disabled={submitting}/></label>
          {!methods.length && <p className="form-warning">No hay métodos de pago activos disponibles.</p>}
          <footer><Link className="secondary" to={`/pedidos/${orderId}`}>Cancelar</Link><button className="primary" type="submit" disabled={submitting || !methods.length}>{submitting ? 'Registrando…' : 'Registrar pago'}</button></footer>
        </form>}
      </section>
    </div>
  </section>
}
