import { Check, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { errorMessage } from '../api/client'
import { createOrder, listClients, listGarmentTypes, listServices } from '../api/orders'
import { GarmentServiceSelector } from '../components/GarmentServiceSelector'
import type { Cliente, PrendaDraft, Servicio, TipoPrenda } from '../types'

const blankGarment = (): PrendaDraft => ({ tipo_prenda_id: '', cantidad: 1, color: '', descripcion: '', servicio_ids: [] })
const steps = ['Cliente', 'Prendas', 'Servicios', 'Fecha', 'Resumen']

export function NewOrderPage() {
  const [step, setStep] = useState(1)
  const [clients, setClients] = useState<Cliente[]>([])
  const [types, setTypes] = useState<TipoPrenda[]>([])
  const [services, setServices] = useState<Servicio[]>([])
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [search, setSearch] = useState('')
  const [garments, setGarments] = useState<PrendaDraft[]>([blankGarment()])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [observations, setObservations] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([listClients(), listGarmentTypes(), listServices()])
      .then(([clientsResponse, typesResponse, servicesResponse]) => {
        setClients(clientsResponse.filter((client) => client.activo))
        setTypes(typesResponse.filter((type) => type.activo))
        setServices(servicesResponse.filter((service) => service.activo))
      })
      .catch((requestError: unknown) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false))
  }, [])

  const filteredClients = useMemo(() => {
    const value = search.toLowerCase().trim()
    if (!value) return clients
    return clients.filter((client) => `${client.nombre} ${client.apellido} ${client.telefono} ${client.email ?? ''}`.toLowerCase().includes(value))
  }, [clients, search])

  function updateGarment(index: number, patch: Partial<PrendaDraft>) {
    setGarments((current) => current.map((garment, garmentIndex) => garmentIndex === index ? { ...garment, ...patch } : garment))
  }

  function next() {
    setError('')
    if (step === 1 && !selected) return setError('Selecciona un cliente para continuar.')
    if (step === 2 && garments.some((garment) => !garment.tipo_prenda_id || !Number.isInteger(garment.cantidad) || garment.cantidad <= 0)) {
      return setError('Selecciona el tipo y una cantidad mayor que cero para cada prenda.')
    }
    if (step === 3 && garments.some((garment) => garment.servicio_ids.length === 0)) {
      return setError('Selecciona al menos un servicio para cada prenda.')
    }
    if (step === 4 && !deliveryDate) return setError('Selecciona una fecha estimada de entrega.')
    setStep((current) => Math.min(current + 1, 5))
  }

  function toggleService(index: number, serviceId: number) {
    setGarments((current) => current.map((garment, garmentIndex) => {
      if (garmentIndex !== index) return garment
      const serviceIds = garment.servicio_ids.includes(serviceId)
        ? garment.servicio_ids.filter((id) => id !== serviceId)
        : [...garment.servicio_ids, serviceId]
      return { ...garment, servicio_ids: serviceIds }
    }))
  }

  const total = garments.reduce((orderTotal, garment) => orderTotal + garment.servicio_ids.reduce((garmentTotal, serviceId) => {
    return garmentTotal + (services.find((service) => service.id === serviceId)?.precio_base ?? 0) * garment.cantidad
  }, 0), 0)

  async function submit() {
    if (!selected || !deliveryDate) return
    setSubmitting(true)
    setError('')
    try {
      const order = await createOrder(selected.id, deliveryDate, observations, garments)
      setCreatedId(order.id)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  function resetForNewOrder() {
    setCreatedId(null)
    setStep(1)
    setSelected(null)
    setSearch('')
    setGarments([blankGarment()])
    setDeliveryDate('')
    setObservations('')
    setError('')
  }

  if (createdId) return <section className="order-success">
    <span><Check size={48} /></span>
    <h1>Pedido creado correctamente</h1>
    <p>Número de pedido</p>
    <strong>#SLV-{String(createdId).padStart(4, '0')}</strong>
    <div className="success-actions"><a className="primary" href={`/pedidos/${createdId}`}>Ver detalle</a><button className="secondary" onClick={resetForNewOrder}>Crear otro pedido</button></div>
  </section>

  return <section className="order-page">
    <div className="stepper">{steps.map((label, index) => {
      const number = index + 1
      return <div className={`step ${step === number ? 'current' : ''} ${step > number ? 'done' : ''}`} key={label}>
        <span>{step > number ? <Check size={19} /> : number}</span>
        <small>{label}</small>
      </div>
    })}</div>
    <section className="wizard-card">
      {step === 1 && <>
        <h1>Seleccionar cliente</h1>
        <p>Busca un cliente existente para asociarlo al pedido.</p>
        <label className="search"><Search size={20} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, teléfono o correo…" /></label>
        <div className="client-list">{loading ? <div className="state"><span className="spinner" />Cargando clientes…</div> : filteredClients.length ? filteredClients.map((client) => <button key={client.id} className={selected?.id === client.id ? 'selected' : ''} onClick={() => setSelected(client)}>
          <span className="avatar">{client.nombre[0]}{client.apellido[0]}</span>
          <span><b>{client.nombre} {client.apellido}</b><small>{client.telefono}{client.email ? ` · ${client.email}` : ''}</small></span>
          {selected?.id === client.id && <Check />}
        </button>) : <div className="state">No se encontraron clientes.</div>}</div>
      </>}

      {step === 2 && <>
        <h1>Agregar prendas</h1>
        <p>Detalla las prendas que trae el cliente.</p>
        {garments.map((garment, index) => <section className="garment" key={index}>
          <header><b>Prenda {index + 1}</b>{garments.length > 1 && <button className="danger-link" onClick={() => setGarments((current) => current.filter((_, garmentIndex) => garmentIndex !== index))}><Trash2 size={17} />Eliminar</button>}</header>
          <div className="form-grid">
            <label>Tipo de prenda *<select value={garment.tipo_prenda_id} onChange={(event) => updateGarment(index, { tipo_prenda_id: Number(event.target.value) || '' })}><option value="">Seleccionar tipo</option>{types.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
            <label>Cantidad *<input type="number" min="1" step="1" value={garment.cantidad} onChange={(event) => updateGarment(index, { cantidad: Number(event.target.value) })} /></label>
            <label>Color<input value={garment.color} maxLength={30} onChange={(event) => updateGarment(index, { color: event.target.value })} placeholder="Blanco, azul…" /></label>
            <label>Observaciones<input value={garment.descripcion} maxLength={255} onChange={(event) => updateGarment(index, { descripcion: event.target.value })} placeholder="Manchas, instrucciones…" /></label>
          </div>
        </section>)}
        <button className="add-link" onClick={() => setGarments((current) => [...current, blankGarment()])}><Plus size={18} />Agregar otra prenda</button>
      </>}

      {step === 3 && <>
        <h1>Asignar servicios</h1>
        <p>Agrega o quita los servicios que necesita cada prenda.</p>
        {garments.map((garment, index) => <section className="garment service-group" key={index}>
          <header><b>{types.find((type) => type.id === garment.tipo_prenda_id)?.nombre} × {garment.cantidad}</b><span className="service-count">{garment.servicio_ids.length} servicio{garment.servicio_ids.length === 1 ? '' : 's'}</span></header>
          <GarmentServiceSelector services={services} selectedIds={garment.servicio_ids} onToggle={(serviceId) => toggleService(index, serviceId)} />
        </section>)}
      </>}

      {step === 4 && <>
        <h1>Fecha estimada de entrega</h1>
        <p>Selecciona cuándo estará listo el pedido.</p>
        <label className="date-field">Fecha estimada de entrega<input type="date" value={deliveryDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
      </>}

      {step === 5 && <>
        <h1>Resumen del pedido</h1>
        <p>Revisa los detalles antes de crear el pedido.</p>
        <div className="summary-client"><small>Cliente</small><b>{selected?.nombre} {selected?.apellido}</b><span>{selected?.telefono}</span></div>
        {garments.map((garment, index) => <div className="summary-garment" key={index}>
          <span><b>{types.find((type) => type.id === garment.tipo_prenda_id)?.nombre} × {garment.cantidad}</b><small>{garment.servicio_ids.map((id) => services.find((service) => service.id === id)?.nombre).filter(Boolean).join(', ')}</small></span>
          <b>Q{garment.servicio_ids.reduce((sum, id) => sum + (services.find((service) => service.id === id)?.precio_base ?? 0) * garment.cantidad, 0).toFixed(2)}</b>
        </div>)}
        <div className="delivery-summary"><small>Entrega estimada</small><b>{new Date(`${deliveryDate}T12:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}</b></div>
        <label className="observations-field">Observaciones del pedido<input value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Instrucciones especiales…" /></label>
        <div className="order-total"><span>Total estimado</span><strong>Q{total.toFixed(2)}</strong></div>
      </>}

      {error && <div className="alert error">{error}</div>}
      <footer>
        {step > 1 ? <button className="secondary" onClick={() => { setError(''); setStep((current) => current - 1) }}><ChevronLeft size={18} />Anterior</button> : <span />}
        {step < 5 ? <button className="primary" onClick={next}>Siguiente<ChevronRight size={18} /></button> : <button className="primary" onClick={() => void submit()} disabled={submitting}><Check size={18} />{submitting ? 'Creando…' : 'Crear pedido'}</button>}
      </footer>
    </section>
  </section>
}
