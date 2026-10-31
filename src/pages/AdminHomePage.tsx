import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listOrderStatuses } from '../api/orders'
import { StatusChip } from '../components/admin/AdminBits'
import { ArrowRightIcon, BarsIcon, CalendarIcon, ChevronRightIcon, ClockIcon, EyeIcon, PlusIcon, SearchIcon, SpinnerIcon, TagIcon, UsersIcon } from '../components/admin/icons'
import { useOrdersOverview } from '../hooks/useOrdersOverview'
import { useAuth } from '../store/auth'
import type { EstadoPedido, PedidoResumen } from '../types'
import {
  MONTHS, MONTHS_SHORT, calendarDay, capitalize, daysBetween, formatShortDate, initials, isActiveOrder, isCancelled,
  money, moneyShort, orderCode, roleLabel, startOfDay,
} from '../utils/adminFormat'

const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` })
const tankColors = ['#0E9BD6', '#5BC3EC', '#FFC93C', '#FFB020', '#7EE0B5', '#9DD8F0', '#F7C873']

/** Avanza de 0 a 1 con la curva del diseño para animar las cifras. */
function useCountUp(run: boolean) {
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!run || reduced) return
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start - 300) / 1300))
      setProgress(1 - Math.pow(1 - t, 3))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [run, reduced])
  return reduced ? 1 : progress
}

function weeklySeries(orders: PedidoResumen[], value: (order: PedidoResumen) => number, date: (order: PedidoResumen) => Date | null) {
  const today = startOfDay()
  const buckets = [0, 0, 0, 0, 0, 0]
  for (const order of orders) {
    const day = date(order)
    if (!day) continue
    const weeksAgo = Math.floor(daysBetween(day, today) / 7)
    if (weeksAgo >= 0 && weeksAgo < 6) buckets[5 - weeksAgo] += value(order)
  }
  const max = Math.max(...buckets, 0)
  return buckets.map((bucket) => (max ? Math.max(10, Math.round((bucket / max) * 100)) : 10))
}

function dueInfo(order: PedidoResumen, today: Date) {
  const due = calendarDay(order.fecha_entrega_estimada)
  if (!due) return { text: 'Por definir', color: '#9A6A00', weight: 600 }
  if (isActiveOrder(order) && due < today) return { text: `${formatShortDate(order.fecha_entrega_estimada)} · vencido`, color: '#C8401F', weight: 600 }
  return { text: formatShortDate(order.fecha_entrega_estimada), color: '#0A2433', weight: 400 }
}

export function AdminHomePage() {
  const navigate = useNavigate()
  const roleId = useAuth((state) => state.roleId)
  const { orders, total, status, error, load } = useOrdersOverview()
  const [statuses, setStatuses] = useState<EstadoPedido[]>([])
  const [query, setQuery] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => { void load(true) }, [load])
  useEffect(() => {
    const controller = new AbortController()
    listOrderStatuses(controller.signal).then((data) => { if (!controller.signal.aborted) setStatuses(data ?? []) }).catch(() => undefined)
    return () => controller.abort()
  }, [])

  const ready = status === 'ready'
  const eased = useCountUp(ready)
  const today = startOfDay()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  const data = useMemo(() => {
    const now = startOfDay()
    const active = orders.filter(isActiveOrder)
    const overdue = active.filter((order) => { const due = calendarDay(order.fecha_entrega_estimada); return due !== null && due < now })
    const noDate = active.filter((order) => !order.fecha_entrega_estimada)
    const week = new Date(now); week.setDate(week.getDate() + 7)
    const upcoming = active
      .map((order) => ({ order, due: calendarDay(order.fecha_entrega_estimada) }))
      .filter((item): item is { order: PedidoResumen; due: Date } => item.due !== null && item.due >= now && item.due <= week)
      .sort((a, b) => a.due.getTime() - b.due.getTime())
    const receivedWeek = orders.filter((order) => { const day = calendarDay(order.fecha_recibido); return day !== null && daysBetween(day, now) <= 7 && day <= now }).length
    const sum = orders.filter((order) => !isCancelled(order.estado_actual)).reduce((acc, order) => acc + order.total, 0)

    const months = new Map<number, { value: number; count: number; month: number }>()
    for (const order of orders) {
      if (isCancelled(order.estado_actual)) continue
      const day = calendarDay(order.fecha_recibido)
      if (!day) continue
      const key = day.getFullYear() * 12 + day.getMonth()
      const entry = months.get(key) ?? { value: 0, count: 0, month: day.getMonth() }
      entry.value += order.total; entry.count += 1
      months.set(key, entry)
    }
    const monthKeys = [...months.keys()].sort((a, b) => a - b).slice(-3)
    const maxMonth = Math.max(...monthKeys.map((key) => months.get(key)!.value), 1)

    const byClient = new Map<number, { name: string; count: number; value: number }>()
    for (const order of orders) {
      if (isCancelled(order.estado_actual)) continue
      const entry = byClient.get(order.cliente.id) ?? { name: `${order.cliente.nombre} ${order.cliente.apellido}`.trim(), count: 0, value: 0 }
      entry.count += 1; entry.value += order.total
      byClient.set(order.cliente.id, entry)
    }
    const topClients = [...byClient.values()].sort((a, b) => b.value - a.value).slice(0, 4)

    return { active, overdue, noDate, upcoming, receivedWeek, sum, months: monthKeys.map((key) => months.get(key)!), maxMonth, topClients }
  }, [orders])

  // Etapas de la planta: catálogo real de estados (sin cancelación), con su conteo.
  const stages = useMemo(() => {
    const flow = (statuses.length ? statuses : [...new Map(orders.map((order) => [order.estado_actual.id, order.estado_actual])).values()])
      .filter((item) => !isCancelled(item))
      .sort((a, b) => a.orden - b.orden)
    const counts = flow.map((item) => orders.filter((order) => order.activo !== false && order.estado_actual.id === item.id).length)
    const max = Math.max(1, ...counts)
    return flow.map((item, index) => ({ item, count: counts[index], height: counts[index] ? Math.max(14, Math.round((counts[index] / max) * 88)) : 0, color: tankColors[index % tankColors.length] }))
  }, [statuses, orders])

  const kpis = [
    { label: 'Pedidos activos', value: String(Math.round(data.active.length * eased)), ibg: '#DDF1FA', ic: '#06709F', nc: '#0A2433', path: 'M5 4h14v17H5zM9 9h6M9 13h6M9 17h3', spark: weeklySeries(data.active, () => 1, (order) => calendarDay(order.fecha_recibido)), sc: '#0E9BD6' },
    { label: 'Recibidos en los últimos 7 días', value: String(Math.round(data.receivedWeek * eased)), ibg: '#E2F6EC', ic: '#1F8A5B', nc: '#0A2433', path: 'M12 3v12M6 9l6 6 6-6M4 21h16', spark: weeklySeries(orders, () => 1, (order) => calendarDay(order.fecha_recibido)), sc: '#7EE0B5' },
    { label: 'Entregas vencidas', value: String(Math.round(data.overdue.length * eased)), ibg: '#FDEDE6', ic: '#C8401F', nc: '#C8401F', path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2', spark: weeklySeries(data.overdue, () => 1, (order) => calendarDay(order.fecha_entrega_estimada)), sc: '#F08A63' },
    { label: 'Valor total de pedidos', value: moneyShort(Math.round(data.sum * eased)), ibg: '#FFF4D6', ic: '#9A6A00', nc: '#0A2433', path: 'M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM9 8h6M9 12h6M9 16h3', spark: weeklySeries(orders.filter((order) => !isCancelled(order.estado_actual)), (order) => order.total, (order) => calendarDay(order.fecha_recibido)), sc: '#FFC93C' },
  ]

  const searchId = Number(query)
  const hit = query ? orders.find((order) => order.id === searchId) : undefined
  function openOrder(event: FormEvent) {
    event.preventDefault()
    setTried(true)
    if (Number.isInteger(searchId) && searchId > 0 && (hit || status !== 'ready')) navigate(`/pedidos/${searchId}`)
  }

  const quick = roleId === 1
    ? { to: '/reportes/ventas', label: 'Reporte de ventas', Icon: BarsIcon }
    : { to: '/promociones', label: 'Promociones', Icon: TagIcon }

  return <>
    <section className="ad-g2" style={{ alignItems: 'end' }}>
      <div>
        <p className="ad-st ad-kicker">Resumen de operación</p>
        <h1 className="ad-disp ad-st ad-h1" style={delay(.06)}>{greeting},<br /><em>{roleLabel(roleId)}.</em></h1>
      </div>
      <form className="ad-st" style={delay(.14)} onSubmit={openOrder}>
        <label htmlFor="home-order" style={{ display: 'block', margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#3E5866' }}>Abrir un pedido por número</label>
        <div className="ad-cmd">
          <span className="pre">#SLV-</span>
          <input id="home-order" type="text" inputMode="numeric" placeholder="0015" value={query} onChange={(event) => { setQuery(event.target.value.replace(/\D/g, '').slice(0, 6)); setTried(false) }} />
          <button className="ad-go" type="submit">Abrir<ArrowRightIcon size={18} /></button>
        </div>
        {hit && <div className="ad-pop ad-hit">
          <span className="ad-disp" style={{ fontWeight: 800, fontSize: 18 }}>{orderCode(hit.id)}</span>
          <span>{hit.cliente.nombre} {hit.cliente.apellido} · {money(hit.total)}</span>
          <StatusChip status={hit.estado_actual} />
        </div>}
        {query && !hit && tried && ready && <p className="ad-pop ad-miss" role="alert">No existe el pedido {orderCode(searchId || 0)}.</p>}
      </form>
    </section>

    <nav className="ad-qa ad-st" style={delay(.2)} aria-label="Accesos rápidos">
      <Link className="ad-q prim" to="/pedidos/nuevo"><span className="qi"><PlusIcon size={22} strokeWidth={2.2} /></span>Nuevo pedido</Link>
      <Link className="ad-q" to="/pedidos"><span className="qi"><SearchIcon size={22} /></span>Consultar pedidos</Link>
      <Link className="ad-q" to="/clientes"><span className="qi"><UsersIcon size={22} /></span>Clientes</Link>
      <Link className="ad-q" to={quick.to}><span className="qi"><quick.Icon size={22} /></span>{quick.label}</Link>
    </nav>

    {status === 'error' && <div className="ad-banner err" role="alert">No pudimos cargar el resumen de pedidos. {error}<button type="button" onClick={() => void load(true)}>Reintentar</button></div>}
    {(status === 'loading' || status === 'idle') && !orders.length && <div className="ad-card ad-st" style={{ marginTop: 20 }}><div className="ad-state" role="status"><SpinnerIcon className="ad-spin" size={28} />Cargando resumen de operación…</div></div>}

    {(ready || orders.length > 0) && <>
      <section className="ad-kpis" aria-label="Indicadores">
        {kpis.map((kpi, index) => <div key={kpi.label} className="ad-kpi ad-st" style={delay(.28 + index * .04)}>
          <span className="ic" style={{ background: kpi.ibg, color: kpi.ic }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={kpi.path} /></svg></span>
          <div className="ad-spark" aria-hidden="true">{kpi.spark.map((height, bar) => <span key={bar} style={{ height: `${height}%`, background: bar === kpi.spark.length - 1 ? kpi.sc : '#DCE7EC', animationDelay: `${(0.4 + bar * 0.06).toFixed(2)}s` }} />)}</div>
          <p className="n" style={{ color: kpi.nc }}>{kpi.value}</p>
          <p className="l">{kpi.label}</p>
        </div>)}
      </section>

      <section className="ad-g2" style={{ marginTop: 20 }}>
        <div className="ad-plant ad-st" style={delay(.4)}>
          <span className="ad-bub" aria-hidden="true" style={{ right: '10%', bottom: -30, width: 24, height: 24 }} />
          <span className="ad-bub" aria-hidden="true" style={{ right: '30%', bottom: -30, width: 12, height: 12, animationDelay: '3s' }} />
          <div className="ad-hd">
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#5BC3EC' }}>En la planta ahora</p>
              <h2 className="ad-disp" style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{data.active.length} {data.active.length === 1 ? 'pedido' : 'pedidos'} en proceso</h2>
            </div>
            {roleId === 1 && <Link className="ad-mini" to="/reportes/pedidos-por-estado" style={{ color: '#FFC93C' }}>Pedidos por estado<ArrowRightIcon size={16} /></Link>}
          </div>
          <div className="ad-stg" style={{ '--n': Math.max(stages.length, 1) } as CSSProperties}>
            {stages.map(({ item, count, height, color }, index) => {
              const shown = Math.round(count * eased)
              const numberColor = !count ? '#3E6A82' : height < 40 ? '#fff' : '#0A2433'
              return <div className="ad-col" key={item.id} aria-label={`${item.nombre}: ${count}`}>
                <div className="ad-tank">
                  <div className="ad-lvl" style={{ height: `${height}%`, background: color, animationDelay: `${(0.5 + index * 0.12).toFixed(2)}s` }}>
                    <svg viewBox="0 0 400 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q 25 0 50 7 T 100 7 T 150 7 T 200 7 T 250 7 T 300 7 T 350 7 T 400 7 V14 H0 Z" fill={color} /></svg>
                  </div>
                  <span className="ad-cnum" style={{ color: numberColor }}>{shown}</span>
                </div>
                <span style={{ color: count ? '#fff' : '#6F8C9B' }}>{item.nombre}</span>
              </div>
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div className="ad-card ad-st" style={delay(.46)}>
            <div className="ad-hd"><h2>Necesitan atención</h2></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              <Link className="ad-alert late" to="/pedidos">
                <span className="ad-ai"><ClockIcon size={20} /></span>
                <span style={{ flex: 1 }}><span className="ad-disp" style={{ display: 'block', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{data.overdue.length}</span><span style={{ fontSize: 14 }}>pedidos con entrega vencida</span></span>
                <ChevronRightIcon size={18} />
              </Link>
              <Link className="ad-alert nodate" to="/pedidos">
                <span className="ad-ai"><CalendarIcon size={20} /></span>
                <span style={{ flex: 1 }}><span className="ad-disp" style={{ display: 'block', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{data.noDate.length}</span><span style={{ fontSize: 14 }}>pedidos sin fecha de entrega</span></span>
                <ChevronRightIcon size={18} />
              </Link>
            </div>
          </div>
          <div className="ad-card ad-st" style={delay(.52)}>
            <div className="ad-hd"><h2>Próximas entregas</h2><span style={{ fontSize: 13, color: '#5A7280' }}>7 días</span></div>
            <div style={{ marginTop: 10 }}>
              {data.upcoming.slice(0, 4).map(({ order, due }) => {
                const days = daysBetween(today, due)
                return <Link key={order.id} className="ad-up" to={`/pedidos/${order.id}`} style={{ textDecoration: 'none', color: '#0A2433' }}>
                  <div className="ad-cal"><b>{MONTHS_SHORT[due.getMonth()]}</b><span>{due.getDate()}</span></div>
                  <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontWeight: 600 }}>{orderCode(order.id)} · {order.cliente.nombre} {order.cliente.apellido}</p><p style={{ margin: '2px 0 0', fontSize: 13, color: '#5A7280' }}>{days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`}</p></div>
                  <StatusChip status={order.estado_actual} />
                </Link>
              })}
              {data.upcoming.length === 0 && <p style={{ margin: '10px 0 0', fontSize: 14, color: '#5A7280' }}>No hay entregas en los próximos 7 días.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="ad-g2" style={{ marginTop: 20 }}>
        <div className="ad-card ad-st" style={delay(.56)}>
          <div className="ad-hd">
            <div><h2>Valor de pedidos por mes</h2><p>Según la fecha de recepción</p></div>
            {roleId === 1 && <Link className="ad-mini" to="/reportes/ventas">Reporte de ventas<ArrowRightIcon size={16} /></Link>}
          </div>
          {data.months.length === 0 ? <p style={{ margin: '24px 0 0', color: '#5A7280' }}>Aún no hay pedidos registrados.</p> : <>
            <div className="ad-bars" style={{ '--n': data.months.length } as CSSProperties} role="img" aria-label={data.months.map((month) => `${capitalize(MONTHS[month.month])}: ${moneyShort(month.value)}`).join(', ')}>
              {data.months.map((month, index) => <div key={index} className="ad-bar" style={{ height: `${Math.max(6, Math.round((month.value / data.maxMonth) * 100))}%`, background: index === data.months.length - 1 ? '#0E9BD6' : '#BFE6F7', animationDelay: `${(0.6 + index * 0.12).toFixed(2)}s` }}><span className="tip">{moneyShort(month.value)}</span></div>)}
            </div>
            <div className="ad-bar-labels" style={{ '--n': data.months.length } as CSSProperties}>
              {data.months.map((month, index) => <div key={index}><p>{capitalize(MONTHS[month.month])}</p><small>{month.count} {month.count === 1 ? 'pedido' : 'pedidos'}</small></div>)}
            </div>
          </>}
        </div>

        <div className="ad-card ad-st" style={delay(.6)}>
          <div className="ad-hd"><h2>Clientes frecuentes</h2><Link className="ad-mini" to="/clientes">Ver todos<ArrowRightIcon size={16} /></Link></div>
          <div style={{ marginTop: 12 }}>
            {data.topClients.map((client, index) => {
              const palette: [string, string][] = [['#0A2433', '#FFC93C'], ['#0E9BD6', '#0A2433'], ['#FFC93C', '#0A2433'], ['#DDF1FA', '#06709F']]
              return <div className="ad-cl" key={client.name + index}>
                <span className="ad-avs" style={{ background: palette[index][0], color: palette[index][1] }}>{initials(client.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{client.name}</p>
                  <div className="ad-track"><span style={{ width: `${Math.round((client.value / (data.topClients[0].value || 1)) * 100)}%` }} /></div>
                </div>
                <div style={{ textAlign: 'right' }}><p className="ad-disp" style={{ margin: 0, fontWeight: 800, fontSize: 17 }}>{moneyShort(client.value)}</p><p style={{ margin: 0, fontSize: 12, color: '#5A7280' }}>{client.count} {client.count === 1 ? 'pedido' : 'pedidos'}</p></div>
              </div>
            })}
            {data.topClients.length === 0 && <p style={{ margin: '10px 0 0', fontSize: 14, color: '#5A7280' }}>Aún no hay clientes con pedidos.</p>}
          </div>
        </div>
      </section>

      <section className="ad-card ad-st" style={{ ...delay(.66), marginTop: 20, paddingBottom: 12 }}>
        <div className="ad-hd"><div><h2>Pedidos recientes</h2><p>Los últimos registrados</p></div><Link className="ad-mini" to="/pedidos">Ver los {total} pedidos<ArrowRightIcon size={16} /></Link></div>
        <div className="ad-tblwrap">
          <table className="ad-table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Recibido</th><th>Entrega estimada</th><th style={{ textAlign: 'right' }}>Total</th><th><span className="ad-sr">Acciones</span></th></tr></thead>
            <tbody>
              {orders.slice(0, 6).map((order, index) => {
                const due = dueInfo(order, today)
                return <tr key={order.id} style={delay(0.7 + index * 0.05)}>
                  <td className="ad-disp" style={{ fontWeight: 800, fontSize: 16 }}>{orderCode(order.id)}</td>
                  <td><span style={{ display: 'block', fontWeight: 600 }}>{order.cliente.nombre} {order.cliente.apellido}</span><span style={{ fontSize: 13, color: '#5A7280' }}>{order.cliente.telefono}</span></td>
                  <td><StatusChip status={order.estado_actual} /></td>
                  <td>{formatShortDate(order.fecha_recibido)}</td>
                  <td style={{ color: due.color, fontWeight: due.weight }}>{due.text}</td>
                  <td className="ad-disp" style={{ textAlign: 'right', fontWeight: 800 }}>{money(order.total)}</td>
                  <td style={{ textAlign: 'right' }}><Link className="ad-vp" to={`/pedidos/${order.id}`} aria-label={`Ver pedido ${orderCode(order.id)}`}>Ver<EyeIcon size={16} /></Link></td>
                </tr>
              })}
              {orders.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#5A7280' }}>Todavía no hay pedidos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </>
}

