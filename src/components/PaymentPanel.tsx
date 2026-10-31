import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { errorMessage, httpStatus } from '../api/client'
import { getOrderBalance, getOrderPayments, listPaymentMethods, registerOrderPayment } from '../api/payments'
import type { MetodoPago, PagoDetalle, SaldoPedido } from '../types'
import { formatDateTime, money, paymentIcon } from '../utils/adminFormat'
import { CardIcon, PathIcon, RefreshIcon, SpinnerIcon } from './admin/icons'


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

  const total = balance?.total ?? 0
  const paidPct = total > 0 ? Math.min(100, Math.round(((balance?.total_pagado ?? 0) / total) * 100)) : 0
  const due = balance?.saldo_pendiente ?? 0

  return <section className="ad-card ad-st" style={{ animationDelay: '.3s' }} aria-labelledby="payments-title">
    <div className="ad-hd2"><span className="ad-hi"><CardIcon size={20} /></span><h2 id="payments-title">Cobro y pagos</h2></div>
    {loading ? <div className="ad-state" role="status" style={{ padding: '24px 0' }}><SpinnerIcon className="ad-spin" size={24} />Cargando saldo e historial…</div>
      : error && !balance ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><p className="ad-perr" role="alert">{error}</p><button className="ad-btn-dark" type="button" onClick={() => void load()}><RefreshIcon size={17} />Reintentar</button></div>
      : <>
        {balance && <>
          <div className="ad-paybar" role="img" aria-label={`Pagado ${money(balance.total_pagado)} de ${money(balance.total)}`}><span className="pp" style={{ width: `${paidPct}%` }} />{due > 0 && <span className="pd" />}</div>
          <dl className="ad-tri2" aria-label="Resumen de saldo">
            <div><dt>Total</dt><dd>{money(balance.total)}</dd></div>
            <div><dt>Pagado</dt><dd style={{ color: '#06709F' }}>{money(balance.total_pagado)}</dd></div>
            <div className={due > 0 ? 'duebx' : 'okbx'}><dt>Saldo</dt><dd>{money(balance.saldo_pendiente)}</dd></div>
          </dl>
        </>}

        {notice && <p className="ad-pop" role="status" style={{ margin: '16px 0 0', padding: '12px 16px', borderRadius: 14, background: '#E2F6EC', color: '#1F5E43', fontWeight: 600 }}>{notice}</p>}

        {balance && due > 0 && <form className="ad-payf" onSubmit={submit} noValidate>
          <div><label className="ad-lbl3" htmlFor="pay-amount">Monto <b>*</b></label>
            <div className="ad-amt"><span aria-hidden="true">Q</span><input id="pay-amount" aria-label="Monto" name="amount" type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')); setError('') }} /><button type="button" onClick={() => { setAmount(due.toFixed(2)); setError('') }}>Saldo total</button></div></div>
          <div><p className="ad-lbl3" id="pay-methods-label">Método de pago <b>*</b></p>
            {methods.length === 0 ? <p className="ad-muted" style={{ margin: 0 }}>No hay métodos de pago activos.</p> : <div className="ad-methods" role="radiogroup" aria-label="Método de pago">
              {methods.map((method) => <button key={method.id} type="button" role="radio" aria-checked={methodId === String(method.id)} className="ad-mth" onClick={() => { setMethodId(String(method.id)); setError('') }}>
                <PathIcon d={paymentIcon(method.nombre)} size={20} />{method.nombre}
              </button>)}
            </div>}</div>
          <div><label className="ad-lbl3" htmlFor="pay-ref">Referencia</label><input className="ad-in3" id="pay-ref" name="reference" value={reference} maxLength={100} onChange={(event) => setReference(event.target.value)} placeholder="Opcional" /></div>
          {error && <p className="ad-perr" role="alert">{error}</p>}
          <button className="ad-payb" type="submit" disabled={saving}>{saving && <SpinnerIcon className="ad-spin" size={18} />}{saving ? 'Registrando…' : 'Registrar pago'}</button>
        </form>}
        {balance && due <= 0 && <p className="ad-pop" style={{ margin: '16px 0 0', padding: '14px 16px', borderRadius: 14, background: '#E2F6EC', color: '#1F5E43', fontWeight: 600 }}>Pedido pagado por completo.</p>}
        {error && balance && due <= 0 && <p className="ad-perr" role="alert" style={{ marginTop: 12 }}>{error}</p>}

        <h3 className="ad-disp" style={{ margin: '22px 0 10px', fontSize: 18, fontWeight: 600 }}>Historial de pagos</h3>
        {!payments.length ? <p style={{ margin: 0, padding: 16, borderRadius: 14, border: '1.5px dashed #DCE7EC', color: '#5A7280', fontSize: 14, textAlign: 'center' }}>Sin pagos registrados.</p>
          : payments.map((payment) => <div className="ad-prec" key={payment.id}>
            <span className="ad-pmi"><PathIcon d={paymentIcon(payment.metodo_pago.nombre)} size={20} /></span>
            <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600 }}>{payment.metodo_pago.nombre}</span><span style={{ fontSize: 13, color: '#5A7280' }}>{formatDateTime(payment.fecha_pago)} · {payment.usuario ? `${payment.usuario.nombre} ${payment.usuario.apellido}` : `Usuario #${payment.usuario_id}`}{payment.referencia ? ` · Ref. ${payment.referencia}` : ''}</span></span>
            <strong className="ad-disp" style={{ color: '#06709F', fontSize: 18 }}>+ {money(payment.monto)}</strong>
          </div>)}
      </>}
  </section>
}
