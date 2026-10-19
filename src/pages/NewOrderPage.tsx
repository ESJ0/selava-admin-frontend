import { Check, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { errorMessage } from '../api/client'
import { listClients } from '../api/clients'
import { createOrder, listGarmentTypes, listServices } from '../api/orders'
import { GarmentServiceSelector } from '../components/GarmentServiceSelector'
import { PromotionOrderQuote, type PromotionOrderState } from '../components/PromotionOrderQuote'
import { chargeSubtotal } from '../utils/chargePricing'
import type { Cliente, ModalidadCobro, PrendaDetalleDraft, PrendaDraft, Servicio, TipoPrenda } from '../types'

const blankDetail = (): PrendaDetalleDraft => ({ cantidad: 1, color: '', descripcion: '', servicio_ids: [] })
const blankGarment = (): PrendaDraft => ({ tipo_prenda_id: '', cantidad: 1, aplicar_servicio_comun: false, servicio_ids_comunes: [], detalles: [blankDetail()] })
const steps = ['Cliente', 'Prendas y servicios', 'Fecha', 'Resumen']

const modalidadDe = (type?: TipoPrenda): ModalidadCobro => type?.modalidad_cobro ?? 'UNIDAD'
const etiquetaMedida = (modalidad: ModalidadCobro) => modalidad === 'LIBRA' ? 'Peso en libras' : modalidad === 'METRO' ? 'Metros' : 'Cantidad'
const unidadMedida = (modalidad: ModalidadCobro, cantidad: number) => modalidad === 'LIBRA' ? (cantidad === 1 ? 'libra' : 'libras') : modalidad === 'METRO' ? (cantidad === 1 ? 'metro' : 'metros') : (cantidad === 1 ? 'unidad' : 'unidades')
const medidaValida = (cantidad: number | '', modalidad: ModalidadCobro) => typeof cantidad === 'number' && Number.isFinite(cantidad) && cantidad > 0 && cantidad <= 99999999.999 && /^\d+(?:\.\d{1,3})?$/.test(String(cantidad)) && (modalidad !== 'UNIDAD' || (Number.isInteger(cantidad) && cantidad <= 50))

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
  const [notice, setNotice] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [promotionState, setPromotionState] = useState<PromotionOrderState | null>(null)

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

  function updateDetail(garmentIndex: number, detailIndex: number, patch: Partial<PrendaDetalleDraft>) {
    setGarments((current) => current.map((garment, currentGarmentIndex) => currentGarmentIndex !== garmentIndex ? garment : {
      ...garment,
      detalles: garment.detalles.map((detail, currentDetailIndex) => currentDetailIndex === detailIndex ? { ...detail, ...patch } : detail),
    }))
  }

  function changeGarmentQuantity(garmentIndex: number, value: string) {
    const cantidad = value === '' ? '' : Number(value)
    setGarments((current) => current.map((garment, index) => {
      if (index !== garmentIndex) return garment
	  const modalidad = modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id))
	  if (modalidad !== 'UNIDAD') {
	    const detail = garment.detalles[0] ?? blankDetail()
	    return { ...garment, cantidad, detalles: [{ ...detail, cantidad: typeof cantidad === 'number' ? cantidad : 0 }] }
	  }
      if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) return { ...garment, cantidad }
      const details = garment.detalles.slice(0, cantidad)
      while (details.length < cantidad) {
        details.push({ ...blankDetail(), servicio_ids: garment.aplicar_servicio_comun ? [...garment.servicio_ids_comunes] : [] })
      }
      return { ...garment, cantidad, detalles: details }
    }))
  }

  function changeGarmentType(garmentIndex: number, value: string) {
	const tipoPrendaID = Number(value) || ''
	updateGarment(garmentIndex, { tipo_prenda_id: tipoPrendaID, cantidad: 1, aplicar_servicio_comun: false, servicio_ids_comunes: [], detalles: [blankDetail()] })
  }

  function next() {
    setError('')
    setNotice('')
    if (step === 1 && !selected) return setError('Selecciona un cliente para continuar.')
    if (step === 2 && garments.some((garment) => {
	  const modalidad = modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id))
	  return !garment.tipo_prenda_id || !medidaValida(garment.cantidad, modalidad) || (modalidad === 'UNIDAD' ? garment.detalles.length !== garment.cantidad : garment.detalles.length !== 1 || garment.detalles[0]?.cantidad !== garment.cantidad)
	})) {
      return setError('Ingresa una cantidad entera para cobro por unidad o una medida decimal positiva para libras y metros.')
    }
    if (step === 2 && garments.some((garment) => !types.find((type) => type.id === garment.tipo_prenda_id)?.precio)) {
      return setError('Configura el precio de cada tipo de prenda antes de continuar.')
    }
    if (step === 2 && garments.some((garment) => garment.detalles.some((detail) => detail.servicio_ids.length === 0))) {
      return setError('Selecciona al menos un servicio para cada detalle de prenda.')
    }
    if (step === 3 && !deliveryDate) return setError('Selecciona una fecha de entrega.')
    if (step === 3) setPromotionState(null)
    setStep((current) => Math.min(current + 1, 4))
  }

  function toggleDetailService(garmentIndex: number, detailIndex: number, serviceId: number) {
    const detail = garments[garmentIndex].detalles[detailIndex]
    updateDetail(garmentIndex, detailIndex, {
      servicio_ids: detail.servicio_ids.includes(serviceId)
        ? detail.servicio_ids.filter((id) => id !== serviceId)
        : [...detail.servicio_ids, serviceId],
    })
  }

  function toggleCommonService(garmentIndex: number, serviceId: number) {
    const garment = garments[garmentIndex]
    const selectedIds = garment.servicio_ids_comunes.includes(serviceId)
      ? garment.servicio_ids_comunes.filter((id) => id !== serviceId)
      : [...garment.servicio_ids_comunes, serviceId]
    updateGarment(garmentIndex, {
      servicio_ids_comunes: selectedIds,
      detalles: garment.detalles.map((detail) => ({ ...detail, servicio_ids: [...selectedIds] })),
    })
  }

  const detailRows = garments.flatMap((garment) => garment.detalles.map((detail) => ({ garment, detail })))
  const garmentSubtotal = (garment: PrendaDraft, detail: PrendaDetalleDraft) =>
    chargeSubtotal(types.find((type) => type.id === garment.tipo_prenda_id)?.precio ?? 0, detail.cantidad)
  const total = detailRows.reduce((sum, { garment, detail }) => sum + Math.round(garmentSubtotal(garment, detail) * 100), 0) / 100

  async function submit() {
    if (!selected || !deliveryDate || !promotionState?.ready) return
    setSubmitting(true)
    setError('')
    try {
      const order = await createOrder(selected.id, deliveryDate, observations, garments, promotionState.selections)
      setCreatedId(order.id)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  function resetForNewOrder() {
    setCreatedId(null)
    setPromotionState(null)
    setStep(1)
    setSelected(null)
    setSearch('')
    setGarments([blankGarment()])
    setDeliveryDate('')
    setObservations('')
    setError('')
    setNotice('')
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
        <h1>Prendas y servicios</h1>
        <p>Indica la cantidad de cada tipo; se creará una subsección individual por prenda.</p>
        {garments.map((garment, garmentIndex) => <section className="garment garment-group" key={garmentIndex}>
          <header><b>Tipo de prenda {garmentIndex + 1}</b>{garments.length > 1 && <button className="danger-link" onClick={() => setGarments((current) => current.filter((_, index) => index !== garmentIndex))}><Trash2 size={17}/>Eliminar tipo</button>}</header>
          <div className="garment-basics">
            <label>Tipo de prenda *<select value={garment.tipo_prenda_id} onChange={(event) => changeGarmentType(garmentIndex, event.target.value)}><option value="">Seleccionar tipo</option>{types.map((type) => <option key={type.id} value={type.id} disabled={type.precio == null}>{type.nombre} — {type.precio == null ? 'Precio pendiente' : `Q${type.precio.toFixed(2)} por ${unidadMedida(modalidadDe(type), 1)}`}</option>)}</select></label>
            {(() => { const modalidad = modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)); return <label>{etiquetaMedida(modalidad)} *<input aria-label={modalidad === 'UNIDAD' ? `Cantidad de ${garmentIndex === 0 ? 'prendas' : `prendas del tipo ${garmentIndex + 1}`}` : etiquetaMedida(modalidad)} type="number" min={modalidad === 'UNIDAD' ? 1 : 0.001} max={modalidad === 'UNIDAD' ? 50 : 99999999.999} step={modalidad === 'UNIDAD' ? 1 : 0.001} value={garment.cantidad} onChange={(event) => changeGarmentQuantity(garmentIndex, event.target.value)}/></label> })()}
          </div>
          <label className="common-service-option"><input type="checkbox" checked={garment.aplicar_servicio_comun} onChange={(event) => updateGarment(garmentIndex, { aplicar_servicio_comun: event.target.checked, ...(!event.target.checked && { servicio_ids_comunes: [] }) })}/><b>Aplicar los mismos servicios a este tipo de prenda</b></label>
          {garment.aplicar_servicio_comun && <section className="type-common-services"><GarmentServiceSelector services={services} selectedIds={garment.servicio_ids_comunes} onToggle={(serviceId) => toggleCommonService(garmentIndex, serviceId)}/></section>}
          <div className="detail-heading"><div><b>Detalle del servicio</b><small>Completa color, observaciones y servicios.</small></div><span>{modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)) === 'UNIDAD' ? `${garment.detalles.length} prendas` : `${garment.cantidad || 0} ${unidadMedida(modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)), Number(garment.cantidad) || 0)}`}</span></div>
          {garment.detalles.map((detail, detailIndex) => <section className="garment-detail" key={detailIndex}>
            <header><b>{modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)) === 'UNIDAD' ? `Prenda ${detailIndex + 1} de ${garment.cantidad}` : `${etiquetaMedida(modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)))}: ${detail.cantidad} ${unidadMedida(modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)), detail.cantidad)}`}</b></header>
            <div className="form-grid">
              <label>Color<input value={detail.color} maxLength={30} onChange={(event) => updateDetail(garmentIndex, detailIndex, { color: event.target.value })} placeholder="Blanco, azul…"/></label>
              <label>Observaciones<input value={detail.descripcion} maxLength={255} onChange={(event) => updateDetail(garmentIndex, detailIndex, { descripcion: event.target.value })} placeholder="Manchas, instrucciones…"/></label>
            </div>
            {garment.aplicar_servicio_comun ? <p className="inherited-services">Los servicios seleccionados para este tipo se aplicarán a esta prenda.</p> : <div className="detail-services"><GarmentServiceSelector services={services} selectedIds={detail.servicio_ids} onToggle={(serviceId) => toggleDetailService(garmentIndex, detailIndex, serviceId)}/></div>}
          </section>)}
        </section>)}
        <button className="add-link add-garment-type" type="button" onClick={() => setGarments((current) => [...current, blankGarment()])}><Plus size={18}/>Agregar otro tipo de prenda</button>
      </>}

      {step === 3 && <>
        <h1>Fecha de entrega</h1>
        <p>Selecciona cuándo estará listo el pedido.</p>
        <label className="date-field">Fecha de entrega<input type="date" value={deliveryDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
      </>}

      {step === 4 && <>
        <h1>Resumen del pedido</h1>
        <p>Revisa las prendas y sus servicios antes de crear el pedido.</p>
        <div className="summary-client"><small>Cliente</small><b>{selected?.nombre} {selected?.apellido}</b><span>{selected?.telefono}</span></div>
        {detailRows.map(({ garment, detail }, index) => <div className="summary-garment" key={index}>
          <span><b>{types.find((type) => type.id === garment.tipo_prenda_id)?.nombre}</b><small>{detail.cantidad} {unidadMedida(modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)), detail.cantidad)} × Q{(types.find((type) => type.id === garment.tipo_prenda_id)?.precio ?? 0).toFixed(2)} por {unidadMedida(modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id)), 1)}{[detail.color, detail.servicio_ids.map((id) => services.find((service) => service.id === id)?.nombre).filter(Boolean).join(', ')].filter(Boolean).length ? ` · ${[detail.color, detail.servicio_ids.map((id) => services.find((service) => service.id === id)?.nombre).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}` : ''}</small></span>
          <b>Subtotal Q{garmentSubtotal(garment, detail).toFixed(2)}</b>
        </div>)}
        <div className="delivery-summary"><small>Fecha de entrega</small><b>{new Date(`${deliveryDate}T12:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}</b></div>
        <label className="observations-field">Observaciones del pedido<input value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Instrucciones especiales…" /></label>
        <PromotionOrderQuote garments={garments} onStatus={setPromotionState} />
        <div className="order-total"><span>Total estimado{promotionState ? '' : ' · calculando'}</span><strong>{promotionState ? `Q${promotionState.quote.total.toFixed(2)}` : `Q${total.toFixed(2)} (sin promociones)`}</strong></div>
      </>}

      {notice && <div className="alert success" role="status">{notice}</div>}
      {error && <div className="alert error">{error}</div>}
      <footer>
        {step > 1 ? <button className="secondary" onClick={() => { setError(''); setNotice(''); setStep((current) => current - 1) }}><ChevronLeft size={18} />Anterior</button> : <span />}
        {step < 4 ? <button className="primary" onClick={next}>Siguiente<ChevronRight size={18} /></button> : <button className="primary" onClick={() => void submit()} disabled={submitting || !promotionState?.ready}><Check size={18} />{submitting ? 'Creando…' : 'Crear pedido'}</button>}
      </footer>
    </section>
  </section>
}
