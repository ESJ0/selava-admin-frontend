import { ArrowRight, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export function OrderLookupPage() {
  const [orderId, setOrderId] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const roleId = useAuth(state => state.roleId)

  function submit(event: FormEvent) {
    event.preventDefault()
    const id = Number(orderId)
    if (!Number.isInteger(id) || id <= 0) {
      setError('Ingresa un número de pedido válido.')
      return
    }
    navigate(`${roleId === 3 ? '/operario/pedidos' : '/pedidos'}/${id}`)
  }

  return <section className="orders-lookup">
    <div className="page-heading"><div><h1>{roleId === 3 ? 'Actualizar pedido' : 'Consultar pedido'}</h1><p>Busca un pedido por su número para ver el detalle y su historial.</p></div></div>
    <form className="lookup-card" onSubmit={submit}>
      <span className="lookup-icon"><Search size={28}/></span>
      <div><h2>Número de pedido</h2><p>Escribe el identificador que aparece en el comprobante.</p></div>
      <label>Pedido
        <span className="order-id-input"><b>#SLV-</b><input aria-label="Número de pedido" inputMode="numeric" value={orderId} onChange={event => { setOrderId(event.target.value.replace(/\D/g, '')); setError('') }} placeholder="0001" autoFocus/></span>
      </label>
      {error && <div className="alert error">{error}</div>}
      <button className="primary" type="submit">Abrir pedido <ArrowRight size={18}/></button>
    </form>
  </section>
}
