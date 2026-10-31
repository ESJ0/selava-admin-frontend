import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { listClients } from '../api/clients'
import { createOrder, listGarmentTypes, listServices } from '../api/orders'
import { GarmentServiceSelector } from '../components/GarmentServiceSelector'
import { PromotionOrderQuote, type PromotionOrderState } from '../components/PromotionOrderQuote'
import { AlertIcon, ArrowRightIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PathIcon, PlusIcon, SearchIcon, SpinnerIcon } from '../components/admin/icons'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import { chargeSubtotal } from '../utils/chargePricing'
import { MONTHS, MONTHS_SHORT, WEEKDAYS, avatarColors, capitalize, daysBetween, formatMeasure, formatPhone, garmentIconPath, initials, longDate, money, orderCode, startOfDay, unitName, unitPer, unitShort } from '../utils/adminFormat'
import type { Cliente, ModalidadCobro, PrendaDetalleDraft, PrendaDraft, Servicio, TipoPrenda } from '../types'

const blankDetail = (): PrendaDetalleDraft => ({ cantidad: 1, color: '', descripcion: '', servicio_ids: [] })
const blankGarment = (): PrendaDraft => ({ tipo_prenda_id: '', cantidad: 1, aplicar_servicio_comun: false, servicio_ids_comunes: [], detalles: [blankDetail()] })
const steps = ['Cliente', 'Prendas y servicios', 'Fecha', 'Resumen']
const swatches: [string, string][] = [['Blanco', '#FFFFFF'], ['Negro', '#1B1B1B'], ['Azul', '#2F5DA8'], ['Gris', '#9AA5AD'], ['Beige', '#D9C3A0'], ['Rojo', '#C0392B']]

const modalidadDe = (type?: TipoPrenda): ModalidadCobro => type?.modalidad_cobro ?? 'UNIDAD'
const etiquetaMedida = (modalidad: ModalidadCobro) => modalidad === 'LIBRA' ? 'Peso en libras' : modalidad === 'METRO' ? 'Metros' : 'Cantidad de prendas'
const medidaValida = (cantidad: number | '', modalidad: ModalidadCobro) => typeof cantidad === 'number' && Number.isFinite(cantidad) && cantidad > 0 && cantidad <= 99999999.999 && /^\d+(?:\.\d{1,3})?$/.test(String(cantidad)) && (modalidad !== 'UNIDAD' || (Number.isInteger(cantidad) && cantidad <= 50))
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parseIso = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day) }
const relativeDays = (days: number) => days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`

export function NewOrderPage() {
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [clients, setClients] = useState<Cliente[]>([])
  const [types, setTypes] = useState<TipoPrenda[]>([])
  const [services, setServices] = useState<Servicio[]>([])
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [search, setSearch] = useState('')
  const [garments, setGarments] = useState<PrendaDraft[]>([blankGarment()])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [monthOffset, setMonthOffset] = useState(0)
  const [observations, setObservations] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const [created, setCreated] = useState<{ id: number; total: number } | null>(null)
  const [promotionState, setPromotionState] = useState<PromotionOrderState | null>(null)
  const latestOrders = useOrdersOverview(state => state.orders)
  const loadOverview = useOrdersOverview(state => state.load)

  useEffect(() => {
    Promise.all([listClients(), listGarmentTypes(), listServices()])
      .then(([clientsResponse, typesResponse, servicesResponse]) => {
        setClients(clientsResponse.filter((client) => client.activo))
        setTypes(typesResponse.filter((type) => type.activo))
        setServices(servicesResponse.filter((service) => service.activo))
      })
      .catch((requestError: unknown) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false))
    void loadOverview()
  }, [loadOverview])

  // Número provisional: el siguiente al último pedido registrado (el definitivo lo asigna el servidor).
  const nextId = latestOrders.length ? Math.max(...latestOrders.map((order) => order.id)) + 1 : null

  const filteredClients = useMemo(() => {
    const value = search.toLowerCase().trim()
    if (!value) return clients
    return clients.filter((client) => `${client.nombre} ${client.apellido} ${client.telefono} ${client.email ?? ''}`.toLowerCase().includes(value))
  }, [clients, search])

  const typeOf = (garment: PrendaDraft) => types.find((type) => type.id === garment.tipo_prenda_id)

  function updateGarment(index: number, patch: Partial<PrendaDraft>) {
    setError('')
    setGarments((current) => current.map((garment, garmentIndex) => garmentIndex === index ? { ...garment, ...patch } : garment))
  }

  function updateDetail(garmentIndex: number, detailIndex: number, patch: Partial<PrendaDetalleDraft>) {
    setError('')
    setGarments((current) => current.map((garment, currentGarmentIndex) => currentGarmentIndex !== garmentIndex ? garment : {
      ...garment,
      detalles: garment.detalles.map((detail, currentDetailIndex) => currentDetailIndex === detailIndex ? { ...detail, ...patch } : detail),
    }))
  }

  function changeGarmentQuantity(garmentIndex: number, value: string) {
    const cantidad = value === '' ? '' : Number(value)
    setError('')
    setGarments((current) => current.map((garment, index) => {
      if (index !== garmentIndex) return garment
      const modalidad = modalidadDe(types.find((type) => type.id === garment.tipo_prenda_id))
      if (modalidad !== 'UNIDAD') {
        const detail = garment.detalles[0] ?? blankDetail()
        return { ...garment, cantidad, detalles: [{ ...detail, cantidad: typeof cantidad === 'number' ? cantidad : 0 }] }
      }
      if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) return { ...garment, cantidad }
      const details = garment.detalles.slice(0, cantidad)
      while (details.length < cantidad) details.push({ ...blankDetail(), servicio_ids: garment.aplicar_servicio_comun ? [...garment.servicio_ids_comunes] : [] })
      return { ...garment, cantidad, detalles: details, ...(cantidad === 1 && { aplicar_servicio_comun: false }) }
    }))
  }

  function stepQuantity(garmentIndex: number, delta: number) {
    const garment = garments[garmentIndex]
    const current = typeof garment.cantidad === 'number' ? garment.cantidad : 0
    const modalidad = modalidadDe(typeOf(garment))
    const next = Math.round((current + delta) * 1000) / 1000
    const min = modalidad === 'UNIDAD' ? 1 : 0.001
    const max = modalidad === 'UNIDAD' ? 50 : 99999999.999
    changeGarmentQuantity(garmentIndex, String(Math.min(max, Math.max(min, next))))
  }

  function changeGarmentType(garmentIndex: number, typeId: number) {
    updateGarment(garmentIndex, { tipo_prenda_id: typeId, cantidad: 1, aplicar_servicio_comun: false, servicio_ids_comunes: [], detalles: [blankDetail()] })
  }

  function validate(target: number) {
    if (target === 1 && !selected) return 'Selecciona un cliente para continuar.'
    if (target === 2) {
      if (garments.some((garment) => {
        const modalidad = modalidadDe(typeOf(garment))
        return !garment.tipo_prenda_id || !medidaValida(garment.cantidad, modalidad) || (modalidad === 'UNIDAD' ? garment.detalles.length !== garment.cantidad : garment.detalles.length !== 1 || garment.detalles[0]?.cantidad !== garment.cantidad)
      })) return 'Ingresa una cantidad entera para cobro por unidad o una medida decimal positiva para libras y metros.'
      if (garments.some((garment) => !typeOf(garment)?.precio)) return 'Configura el precio de cada tipo de prenda antes de continuar.'
      if (garments.some((garment) => garment.detalles.some((detail) => detail.servicio_ids.length === 0))) return 'Selecciona al menos un servicio para cada detalle de prenda.'
    }
    if (target === 3 && !deliveryDate) return 'Selecciona una fecha de entrega.'
    return ''
  }

  function goTo(target: number) {
    if (submitting || target > maxStep) return
    setError('')
    setStep(target)
  }

  function next() {
    if (submitting) return
    const problem = validate(step)
    if (problem) { setError(problem); setShake((value) => value + 1); return }
    setError('')
    if (step === 3) setPromotionState(null)
    const target = Math.min(step + 1, 4)
    setStep(target)
    setMaxStep((value) => Math.max(value, target))
  }

  function toggleDetailService(garmentIndex: number, detailIndex: number, serviceId: number) {
    const detail = garments[garmentIndex].detalles[detailIndex]
    updateDetail(garmentIndex, detailIndex, { servicio_ids: detail.servicio_ids.includes(serviceId) ? detail.servicio_ids.filter((id) => id !== serviceId) : [...detail.servicio_ids, serviceId] })
  }

  function toggleCommonService(garmentIndex: number, serviceId: number) {
    const garment = garments[garmentIndex]
    const selectedIds = garment.servicio_ids_comunes.includes(serviceId) ? garment.servicio_ids_comunes.filter((id) => id !== serviceId) : [...garment.servicio_ids_comunes, serviceId]
    updateGarment(garmentIndex, { servicio_ids_comunes: selectedIds, detalles: garment.detalles.map((detail) => ({ ...detail, servicio_ids: [...selectedIds] })) })
  }

  function toggleCommon(garmentIndex: number) {
    const garment = garments[garmentIndex]
    const enabled = !garment.aplicar_servicio_comun
    updateGarment(garmentIndex, { aplicar_servicio_comun: enabled, ...(!enabled && { servicio_ids_comunes: [] }) })
  }

  const blockSubtotal = (garment: PrendaDraft) => {
    const price = typeOf(garment)?.precio ?? 0
    return garment.detalles.reduce((sum, detail) => sum + Math.round(chargeSubtotal(price, detail.cantidad) * 100), 0) / 100
  }
  const typedGarments = garments.filter((garment) => typeOf(garment))
  const normalTotal = typedGarments.reduce((sum, garment) => sum + Math.round(blockSubtotal(garment) * 100), 0) / 100
  const quote = promotionState?.quote
  const total = step === 4 && quote ? quote.total : normalTotal

  async function submit() {
    if (!selected || !deliveryDate || !promotionState?.ready || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const order = await createOrder(selected.id, deliveryDate, observations, garments, promotionState.selections)
      setCreated({ id: order.id, total: promotionState.quote.total })
      void loadOverview(true)
    } catch (requestError) {
      setError(errorMessage(requestError))
      setShake((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  function resetForNewOrder() {
    setCreated(null); setPromotionState(null); setStep(1); setMaxStep(1); setSelected(null); setSearch('')
    setGarments([blankGarment()]); setDeliveryDate(''); setMonthOffset(0); setObservations(''); setError('')
  }

  const today = startOfDay()
  const chosen = deliveryDate ? parseIso(deliveryDate) : null
  const chosenDays = chosen ? daysBetween(today, chosen) : 0
  const lineDetail = (garment: PrendaDraft) => {
    const type = typeOf(garment)!
    const mode = modalidadDe(type)
    const measure = Number(garment.cantidad) || 0
    const colors = [...new Set(garment.detalles.map((detail) => detail.color.trim()).filter(Boolean))]
    const serviceIds = [...new Set(garment.detalles.flatMap((detail) => detail.servicio_ids))]
    return [`${formatMeasure(measure)} ${unitName(mode, measure)} × Q${(type.precio ?? 0).toFixed(2)} ${unitPer(mode)}`, colors.join(', ').toLowerCase(), serviceIds.map((id) => services.find((service) => service.id === id)?.nombre).filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  }

  if (created) return <div className="ad-done">
    <div className="ad-dslot" aria-hidden="true" />
    <div className="ad-dpaper">
      <div className="ad-stampd" aria-hidden="true"><CheckIcon size={26} strokeWidth={2.8} /><span className="ad-disp">CREADO</span></div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.18em', color: '#5A7280' }}>NÚMERO DE PEDIDO</p>
      <p className="ad-disp" style={{ margin: '6px 0 14px', fontSize: 52, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{orderCode(created.id)}</p>
      <div className="ad-lr"><span>Cliente</span><strong>{selected?.nombre} {selected?.apellido}</strong></div>
      <div className="ad-lr"><span>Entrega</span><strong>{chosen ? longDate(chosen) : '—'}</strong></div>
      <div className="ad-lr"><span>Total</span><strong className="ad-disp" style={{ fontSize: 22 }}>{money(created.total)}</strong></div>
    </div>
    <h1 className="ad-disp ad-st" style={{ animationDelay: '1.4s', margin: '32px 0 8px', fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', textAlign: 'center' }}>Pedido creado correctamente</h1>
    <div className="ad-st" style={{ animationDelay: '1.55s', display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
      <Link className="ad-nextb" to={`/pedidos/${created.id}`}><span>Ver detalle</span><span className="nd"><ArrowRightIcon size={18} strokeWidth={2.6} /></span></Link>
      <button className="ad-prevb" type="button" onClick={resetForNewOrder}><PlusIcon size={18} strokeWidth={2.4} />Crear otro pedido</button>
    </div>
  </div>

  // Calendario del paso 3.
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const lead = (base.getDay() + 6) % 7
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const quick = [[1, 'Mañana'], [3, 'En 3 días'], [7, 'En una semana'], [14, 'En dos semanas']] as const

  return <section>
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
      <div>
        <p className="ad-st ad-kicker">Pedidos</p>
        <h1 className="ad-disp ad-st ad-h1 sm" style={{ animationDelay: '.06s' }}>Nuevo pedido<em>.</em></h1>
      </div>
      {nextId && <span className="ad-st" style={{ animationDelay: '.1s', display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 12, background: '#fff', border: '1px solid #DCE7EC', fontSize: 14, color: '#3E5866' }} title="Número provisional; el definitivo se asigna al guardar">Se creará como <strong className="ad-disp" style={{ color: '#0A2433', fontSize: 16 }}>{orderCode(nextId)}</strong></span>}
    </div>

    <ol className="ad-stepper ad-st" style={{ animationDelay: '.12s' }} aria-label="Pasos del pedido">
      <span className="ad-sline" aria-hidden="true"><span style={{ width: `${((step - 1) / 3) * 100}%` }} /></span>
      {steps.map((label, index) => {
        const number = index + 1
        const done = number < step
        const current = number === step
        return <li key={label}>
          <button type="button" className={`ad-sb${done ? ' done' : ''}${current ? ' cur' : ''}`} onClick={() => goTo(number)} disabled={number > maxStep || submitting} aria-current={current ? 'step' : undefined} aria-label={`Paso ${number}: ${label}`}>
            {done ? <CheckIcon size={18} strokeWidth={3} /> : <span>{number}</span>}
          </button>
          <span className="ad-slab" style={{ color: number <= step ? '#0A2433' : '#8AA3B0' }}>{label}</span>
        </li>
      })}
    </ol>

    <div className="ad-np">
      <section className="ad-pane">
        {step === 1 && <div className="ad-sp">
          <div className="ad-hdr"><div><h2 className="ad-disp">Seleccionar cliente</h2><p>Busca un cliente existente para asociarlo al pedido.</p></div>
            <Link className="ad-ghostl" to="/clientes"><PlusIcon size={16} strokeWidth={2.4} />Nuevo cliente</Link></div>
          <label className="ad-srch2"><SearchIcon size={20} stroke="#5A7280" /><span className="ad-sr">Buscar cliente</span>
            <input type="search" placeholder="Buscar por nombre, teléfono o correo…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="ad-clist" role="radiogroup" aria-label="Clientes">
            {loading ? <p className="ad-muted" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><SpinnerIcon className="ad-spin" size={20} />Cargando clientes…</p>
              : filteredClients.map((client, index) => {
                const name = `${client.nombre} ${client.apellido}`.trim()
                const ini = initials(name)
                const [bg, fg] = avatarColors(ini)
                const isSelected = selected?.id === client.id
                return <button key={client.id} type="button" role="radio" aria-checked={isSelected} className="ad-copt" style={{ animationDelay: `${(0.05 * Math.min(index, 10)).toFixed(2)}s` }} onClick={() => { setSelected(client); setError('') }}>
                  <span className="ad-cav" style={{ background: bg, color: fg }}>{ini}</span>
                  <span style={{ minWidth: 0 }}><b>{name}</b><span className="ad-csub">{formatPhone(client.telefono)}{client.email ? ` · ${client.email}` : ''}</span></span>
                  <span className="ad-radio"><CheckIcon size={14} strokeWidth={3.4} /></span>
                </button>
              })}
            {!loading && filteredClients.length === 0 && <p className="ad-muted" style={{ margin: '8px 0' }}>No hay clientes que coincidan con la búsqueda.</p>}
          </div>
        </div>}

        {step === 2 && <div className="ad-sp">
          <div className="ad-hdr"><div><h2 className="ad-disp">Prendas y servicios</h2><p>Indica la cantidad de cada tipo; se creará una subsección individual por prenda.</p></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {garments.map((garment, garmentIndex) => {
              const type = typeOf(garment)
              const mode = modalidadDe(type)
              const quantityLabel = etiquetaMedida(mode)
              const multi = mode === 'UNIDAD' && typeof garment.cantidad === 'number' && garment.cantidad > 1
              return <article className="ad-blk" key={garmentIndex}>
                <div className="ad-blk-head">
                  <p className="ad-disp">Tipo de prenda {garmentIndex + 1}</p>
                  {garments.length > 1 && <button className="ad-rm" type="button" onClick={() => setGarments((current) => current.filter((_, index) => index !== garmentIndex))} aria-label={`Quitar tipo de prenda ${garmentIndex + 1}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>}
                </div>
                <div className="ad-types" role="radiogroup" aria-label={`Tipo de prenda ${garmentIndex + 1}`}>
                  {types.map((option) => {
                    const optionMode = modalidadDe(option)
                    return <button key={option.id} type="button" role="radio" aria-checked={garment.tipo_prenda_id === option.id} className="ad-tt" disabled={option.precio == null} onClick={() => changeGarmentType(garmentIndex, option.id)} aria-label={`${option.nombre} — ${option.precio == null ? 'Precio pendiente' : `Q${option.precio.toFixed(2)} ${unitPer(optionMode)}`}`}>
                      <span className="ti"><PathIcon d={garmentIconPath(option.nombre, optionMode)} size={26} strokeWidth={1.8} /></span>
                      <span className="ad-disp nm">{option.nombre}</span>
                      <span className="pr">{option.precio == null ? 'Precio pendiente' : `Q${option.precio.toFixed(2)} ${unitPer(optionMode)}`}</span>
                    </button>
                  })}
                  {!loading && types.length === 0 && <p className="ad-muted">No hay tipos de prenda activos.</p>}
                </div>
                {type && <>
                  <div className="ad-qrow">
                    <div>
                      <label className="ad-lbl2" htmlFor={`qty-${garmentIndex}`}>{quantityLabel} <b>*</b></label>
                      <div className="ad-qty">
                        <button type="button" onClick={() => stepQuantity(garmentIndex, -1)} aria-label="Restar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg></button>
                        <input id={`qty-${garmentIndex}`} aria-label={quantityLabel} type="number" min={mode === 'UNIDAD' ? 1 : 0.001} max={mode === 'UNIDAD' ? 50 : 99999999.999} step={mode === 'UNIDAD' ? 1 : 0.001} value={garment.cantidad} onChange={(event) => changeGarmentQuantity(garmentIndex, event.target.value)} />
                        <span className="ad-unit">{unitShort(mode)}</span>
                        <button type="button" onClick={() => stepQuantity(garmentIndex, 1)} aria-label="Sumar"><PlusIcon size={18} strokeWidth={2.6} /></button>
                      </div>
                    </div>
                    {multi && <button className="ad-same" type="button" role="switch" aria-checked={garment.aplicar_servicio_comun} aria-label="Aplicar los mismos servicios a este tipo de prenda" onClick={() => toggleCommon(garmentIndex)}>
                      <span className="ad-trk"><span className="ad-knb" /></span>
                      <span><b>Mismos servicios para todas</b><small>Aplica una sola selección a las {garment.cantidad} prendas</small></span>
                    </button>}
                    <span className="ad-subt">{money(blockSubtotal(garment))}</span>
                  </div>

                  {garment.aplicar_servicio_comun && multi && <div className="ad-svcbox">
                    <GarmentServiceSelector services={services} selectedIds={garment.servicio_ids_comunes} onToggle={(serviceId) => toggleCommonService(garmentIndex, serviceId)} title="Servicios para todas" />
                  </div>}

                  <div className="ad-pieces-head">
                    <p className="ad-lbl2" style={{ margin: 0 }}>Detalle por prenda</p>
                    <span className="ad-pc">{mode === 'UNIDAD' ? `${garment.detalles.length} ${garment.detalles.length === 1 ? 'prenda' : 'prendas'}` : `1 lote · ${formatMeasure(Number(garment.cantidad) || 0)} ${unitShort(mode)}`}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {garment.detalles.map((detail, detailIndex) => {
                      const chosenServices = detail.servicio_ids.map((id) => services.find((service) => service.id === id)?.nombre).filter(Boolean)
                      return <div className="ad-piece" key={detailIndex} style={{ animationDelay: `${(0.04 * Math.min(detailIndex, 10)).toFixed(2)}s` }}>
                        <div className="ad-piece-head">
                          <p><span className="ad-pn">{detailIndex + 1}</span>{mode === 'UNIDAD' ? `Prenda ${detailIndex + 1} de ${garment.cantidad}` : `${type.nombre} · ${formatMeasure(detail.cantidad)} ${unitShort(mode)}`}</p>
                          {chosenServices.length > 0 && <span>{chosenServices.join(' · ')}</span>}
                        </div>
                        <div className="ad-pg2">
                          <div>
                            <label className="ad-lbl2" htmlFor={`color-${garmentIndex}-${detailIndex}`}>Color</label>
                            <input className="ad-mi2" id={`color-${garmentIndex}-${detailIndex}`} value={detail.color} maxLength={30} onChange={(event) => updateDetail(garmentIndex, detailIndex, { color: event.target.value })} placeholder="Blanco, azul…" />
                            <div className="ad-sws">
                              {swatches.map(([colorName, hex]) => <button key={colorName} type="button" className="ad-swb" style={{ background: hex }} aria-pressed={detail.color.trim().toLowerCase() === colorName.toLowerCase()} onClick={() => updateDetail(garmentIndex, detailIndex, { color: colorName })} aria-label={`Color ${colorName}`} title={colorName} />)}
                            </div>
                          </div>
                          <div><label className="ad-lbl2" htmlFor={`obs-${garmentIndex}-${detailIndex}`}>Observaciones</label><input className="ad-mi2" id={`obs-${garmentIndex}-${detailIndex}`} value={detail.descripcion} maxLength={255} onChange={(event) => updateDetail(garmentIndex, detailIndex, { descripcion: event.target.value })} placeholder="Manchas, instrucciones…" /></div>
                        </div>
                        {!(garment.aplicar_servicio_comun && multi) && <div style={{ marginTop: 14 }}><GarmentServiceSelector services={services} selectedIds={detail.servicio_ids} onToggle={(serviceId) => toggleDetailService(garmentIndex, detailIndex, serviceId)} /></div>}
                      </div>
                    })}
                  </div>
                </>}
              </article>
            })}
            <button className="ad-addb" type="button" onClick={() => setGarments((current) => [...current, blankGarment()])}><span className="ap"><PlusIcon size={18} strokeWidth={2.6} /></span>Agregar otro tipo de prenda</button>
          </div>
        </div>}

        {step === 3 && <div className="ad-sp">
          <div className="ad-hdr"><div><h2 className="ad-disp">Fecha de entrega</h2><p>Selecciona cuándo estará listo el pedido.</p></div></div>
          <div className="ad-quick">
            {quick.map(([days, label]) => {
              const date = new Date(today); date.setDate(date.getDate() + days)
              const value = isoDate(date)
              return <button key={days} type="button" className="ad-qk" aria-pressed={deliveryDate === value} onClick={() => { setDeliveryDate(value); setMonthOffset((date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth()); setError('') }}>
                <b>{label}</b><small>{WEEKDAYS[date.getDay()].slice(0, 3)} {date.getDate()} {MONTHS_SHORT[date.getMonth()].toLowerCase()}</small>
              </button>
            })}
          </div>
          <div className="ad-calwrap" role="group" aria-label="Fecha de entrega">
            <div className="ad-calhd">
              <button className="ad-cn" type="button" onClick={() => setMonthOffset((value) => Math.max(0, value - 1))} disabled={monthOffset <= 0} aria-label="Mes anterior"><ChevronLeftIcon size={18} strokeWidth={2.4} /></button>
              <p className="ad-disp" aria-live="polite">{capitalize(MONTHS[base.getMonth()])} {base.getFullYear()}</p>
              <button className="ad-cn" type="button" onClick={() => setMonthOffset((value) => value + 1)} aria-label="Mes siguiente"><ChevronRightIcon size={18} strokeWidth={2.4} /></button>
            </div>
            <div className="ad-cgrid7 ad-wd" aria-hidden="true">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <span key={index}>{day}</span>)}</div>
            <div className="ad-cgrid7">
              {Array.from({ length: lead }, (_, index) => <span key={`e${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const date = new Date(base.getFullYear(), base.getMonth(), index + 1)
                const value = isoDate(date)
                const past = date < today
                const cls = `ad-dd${past ? ' past' : ''}${date.getTime() === today.getTime() ? ' today' : ''}${date.getDay() === 0 ? ' sun' : ''}`
                return <button key={value} type="button" className={cls} disabled={past} aria-pressed={deliveryDate === value} aria-label={`${index + 1} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`} onClick={() => { setDeliveryDate(value); setError('') }}>{index + 1}</button>
              })}
            </div>
          </div>
          {chosen && <div className="ad-datesel ad-pop">
            <span className="ad-cal2"><b>{MONTHS_SHORT[chosen.getMonth()]}</b><span>{chosen.getDate()}</span></span>
            <span><small>Entrega estimada</small><strong className="ad-disp">{longDate(chosen)}</strong></span>
            <em>{relativeDays(chosenDays)}</em>
          </div>}
        </div>}

        {step === 4 && <div className="ad-sp">
          <div className="ad-hdr"><div><h2 className="ad-disp">Resumen del pedido</h2><p>Revisa las prendas y sus servicios antes de crear el pedido.</p></div></div>
          <div className="ad-sumgrid">
            <div className="ad-sbox"><p className="ad-sk">Cliente</p><p className="ad-sv">{selected?.nombre} {selected?.apellido}</p><p style={{ marginTop: 2, color: '#3E5866' }}>{selected ? formatPhone(selected.telefono) : ''}</p><button className="ad-edit" type="button" onClick={() => goTo(1)}>Cambiar</button></div>
            <div className="ad-sbox blue"><p className="ad-sk">Fecha de entrega</p><p className="ad-sv">{chosen ? longDate(chosen) : '—'}</p><p style={{ marginTop: 2, color: '#3E5866' }}>{chosen ? relativeDays(chosenDays) : ''}</p><button className="ad-edit" type="button" onClick={() => goTo(3)}>Cambiar</button></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }} aria-label="Prendas del pedido">
            {typedGarments.map((garment, index) => {
              const type = typeOf(garment)!
              const group = quote?.grupos.find((item) => item.tipo_prenda_id === type.id)
              const sameTypeBlocks = typedGarments.filter((item) => item.tipo_prenda_id === type.id).length
              const promoted = Boolean(group?.aplicada) && sameTypeBlocks === 1
              const normal = blockSubtotal(garment)
              return <div className="ad-line" key={index} style={{ animationDelay: `${(0.05 * index).toFixed(2)}s` }}>
                <span className="ad-lic"><PathIcon d={garmentIconPath(type.nombre, modalidadDe(type))} size={22} strokeWidth={1.8} /></span>
                <div style={{ minWidth: 0 }}><p className="ad-disp" style={{ fontSize: 18, fontWeight: 600 }}>{type.nombre}</p><p style={{ marginTop: 2, fontSize: 13, color: '#5A7280' }}>{lineDetail(garment)}{promoted ? ` · Promo ${group!.aplicada!.nombre}` : ''}</p></div>
                <div style={{ textAlign: 'right' }}>{promoted && <p style={{ fontSize: 13, color: '#5A7280', textDecoration: 'line-through' }}>{money(normal)}</p>}<p className="ad-disp" style={{ fontSize: 20, fontWeight: 800 }}>{money(promoted ? group!.subtotal_total : normal)}</p></div>
              </div>
            })}
          </div>
          <PromotionOrderQuote garments={garments} onStatus={setPromotionState} />
          <div style={{ marginTop: 18 }}><label className="ad-lbl2" htmlFor="np-obs">Observaciones del pedido</label><textarea className="ad-mi2" id="np-obs" rows={2} placeholder="Instrucciones especiales…" value={observations} maxLength={500} onChange={(event) => setObservations(event.target.value)} /></div>
        </div>}

        {error && <p className="ad-err2" role="alert"><AlertIcon size={18} />{error}</p>}

        <div className="ad-nav2">
          {step > 1 ? <button className="ad-prevb" type="button" disabled={submitting} onClick={() => { setError(''); setStep((current) => current - 1) }}><ChevronLeftIcon size={18} strokeWidth={2.4} />Anterior</button> : <span />}
          {step < 4
            ? <button className={`ad-nextb${error ? ` ad-shk${shake % 2}` : ''}`} type="button" onClick={next}><span>Siguiente</span><span className="nd"><ChevronRightIcon size={18} strokeWidth={2.6} /></span></button>
            : <button className={`ad-nextb final${error ? ` ad-shk${shake % 2}` : ''}`} type="button" onClick={() => void submit()} disabled={submitting || !promotionState?.ready} aria-label={submitting ? 'Creando pedido…' : 'Crear pedido'}>
              <span>{submitting ? 'Creando pedido…' : promotionState?.ready ? 'Crear pedido' : 'Calculando total…'}</span>
              <span className="nd">{submitting || !promotionState?.ready ? <SpinnerIcon className="ad-spin" size={18} /> : <CheckIcon size={18} strokeWidth={2.6} />}</span>
            </button>}
        </div>
      </section>

      <aside className="ad-live ad-st" style={{ animationDelay: '.2s' } as CSSProperties} aria-label="Resumen en vivo">
        <div className="ad-slot" aria-hidden="true" />
        <div className="ad-paper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1.5px dashed #C9D8DF' }}>
            <span className="ad-disp" style={{ fontWeight: 800, fontSize: 18 }}>Se<span style={{ color: '#06709F' }}>Lava</span></span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.16em', color: '#5A7280' }}>{nextId ? orderCode(nextId) : 'NUEVO'}</span>
          </div>
          <div className="ad-lr"><span>Cliente</span><strong>{selected ? `${selected.nombre} ${selected.apellido}` : '—'}</strong></div>
          <div style={{ padding: '10px 0', borderBottom: '1.5px dashed #C9D8DF' }}>
            {typedGarments.map((garment, index) => {
              const type = typeOf(garment)!
              const mode = modalidadDe(type)
              return <div className="ad-tline" key={index}><span>{type.nombre} · {formatMeasure(Number(garment.cantidad) || 0)} {unitShort(mode)}</span><strong>{money(blockSubtotal(garment))}</strong></div>
            })}
            {typedGarments.length === 0 && <p style={{ margin: '4px 0', fontSize: 13, color: '#8AA3B0' }}>Aún sin prendas</p>}
          </div>
          <div className="ad-lr"><span>Entrega</span><strong>{chosen ? `${chosen.getDate()} ${MONTHS_SHORT[chosen.getMonth()].toLowerCase()} ${chosen.getFullYear()}` : '—'}</strong></div>
          <div className="ad-lr ad-ticket-total" style={{ borderTop: '1.5px dashed #C9D8DF', paddingTop: 12, marginTop: 4 }}><span className="ad-disp" style={{ fontSize: 16, fontWeight: 800, color: '#0A2433' }}>Total estimado</span><strong className="ad-disp" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>{money(total)}</strong></div>
          <div className="ad-barcode" aria-hidden="true" />
        </div>
        <p style={{ margin: '12px 4px 0', fontSize: 13, color: '#5A7280', textAlign: 'center' }}>{step === 4 && quote ? 'Incluye las promociones seleccionadas.' : 'Los servicios asociados no añaden recargos.'}</p>
      </aside>
    </div>
  </section>
}
