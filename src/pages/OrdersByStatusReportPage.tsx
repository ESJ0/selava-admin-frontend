import { CalendarDays, ChartPie, CircleDot, ClipboardList, Download, Layers3, RefreshCw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { errorMessage } from '../api/client'
import { getOrdersByStatusReport } from '../api/reports'
import type { ReportePedidosPorEstado } from '../types'
import { exportOrdersByStatusReportPdf } from '../utils/reportPdf'

const STATUS_COLORS = ['#05aff2', '#7357d9', '#00b87b', '#f4a340', '#e85b6b', '#58708f']

interface Periodo { inicio: string; fin: string }

function inputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function initialPeriod(): Periodo {
  const today = new Date()
  return { inicio: inputDate(new Date(today.getFullYear(), today.getMonth(), 1)), fin: inputDate(today) }
}

function dateFromApi(value: string) { return new Date(`${value}T12:00:00`) }
const longDate = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })

function statusColor(index: number) {
  return STATUS_COLORS[index % STATUS_COLORS.length]
}

function stateColor(order: number) {
  return statusColor(Math.max(0, order - 1))
}

export function OrdersByStatusReportPage() {
  const [filters, setFilters] = useState<Periodo>(initialPeriod)
  const [appliedPeriod, setAppliedPeriod] = useState<Periodo>(initialPeriod)
  const [report, setReport] = useState<ReportePedidosPorEstado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const request = useRef<AbortController | null>(null)

  const load = useCallback(async (period: Periodo) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setReport(null)
    setAppliedPeriod(period)
    try {
      const response = await getOrdersByStatusReport(period.inicio, period.fin, controller.signal)
      if (!controller.signal.aborted) setReport(response)
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const period = initialPeriod()
    const timer = window.setTimeout(() => { void load(period) }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!filters.inicio || !filters.fin) {
      setValidationError('Selecciona ambas fechas para generar el reporte.')
      return
    }
    if (filters.inicio > filters.fin) {
      setValidationError('La fecha de inicio no puede ser posterior a la fecha final.')
      return
    }
    setValidationError('')
    void load(filters)
  }

  const activeStates = useMemo(() => report?.pedidos_por_estado.filter((item) => item.cantidad_pedidos > 0) ?? [], [report])
  const leadingState = useMemo(() => activeStates.reduce<(typeof activeStates)[number] | null>((leading, item) => !leading || item.cantidad_pedidos > leading.cantidad_pedidos ? item : leading, null), [activeStates])

  return <section className="report-page order-status-report-page">
    <header className="page-heading report-heading">
      <div><h1>Pedidos por estado</h1><p>Visualiza la distribución actual de los pedidos activos.</p></div>
      {report && <button className="secondary report-download" type="button" onClick={() => exportOrdersByStatusReportPdf(report)}><Download size={18}/>Descargar PDF</button>}
    </header>

    <form className="report-filters" aria-label="Filtros del reporte de pedidos por estado" onSubmit={submit}>
      <div className="report-filter-title"><span><CalendarDays size={21}/></span><div><b>Período del reporte</b><small>Selecciona un rango de fechas</small></div></div>
      <label>Desde<input aria-label="Fecha de inicio" type="date" required value={filters.inicio} onChange={(event) => setFilters((current) => ({ ...current, inicio: event.target.value }))}/></label>
      <label>Hasta<input aria-label="Fecha final" type="date" required value={filters.fin} onChange={(event) => setFilters((current) => ({ ...current, fin: event.target.value }))}/></label>
      <button className="primary" type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Aplicar filtro'}</button>
    </form>

    {validationError && <div className="alert error" role="alert">{validationError}</div>}
    {error && <div className="alert error" role="alert"><span>{error}</span><button type="button" onClick={() => void load(appliedPeriod)}><RefreshCw size={16}/>Reintentar</button></div>}

    {loading ? <div className="report-loading" role="status"><span className="spinner"/>Generando reporte…</div> : report && <>
      <div className="report-period-label">Resultados del {longDate.format(dateFromApi(report.fecha_inicio))} al {longDate.format(dateFromApi(report.fecha_fin))}</div>
      <section className="report-metrics order-status-metrics" aria-label="Resumen de pedidos por estado">
        <article><span className="metric-icon sales"><ClipboardList size={23}/></span><div><small>Pedidos activos</small><strong>{report.total_pedidos}</strong><span>Total incluido en el reporte</span></div></article>
        <article><span className="metric-icon orders"><Layers3 size={23}/></span><div><small>Estados con pedidos</small><strong>{activeStates.length}</strong><span>De {report.pedidos_por_estado.length} estados registrados</span></div></article>
        <article><span className="metric-icon average"><Trophy size={23}/></span><div><small>Estado predominante</small><strong className="metric-state-name">{leadingState?.estado.nombre ?? 'Sin pedidos'}</strong><span>{leadingState ? `${leadingState.cantidad_pedidos} ${leadingState.cantidad_pedidos === 1 ? 'pedido' : 'pedidos'}` : 'No hay actividad actual'}</span></div></article>
      </section>

      <section className="order-status-grid">
        <article className="report-card status-chart-card">
          <header><div><h2>Distribución de pedidos</h2><p>Proporción por estado actual</p></div><span className="report-card-icon"><ChartPie size={20}/></span></header>
          {report.total_pedidos === 0 ? <div className="report-empty"><ClipboardList size={42}/><b>No hay pedidos activos</b><span>La distribución aparecerá cuando existan pedidos.</span></div> : <div className="status-chart-content">
            <div className="status-donut" role="img" aria-label="Gráfica de pedidos por estado">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={activeStates} dataKey="cantidad_pedidos" nameKey="estado.nombre" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="none">
                    {activeStates.map((item) => <Cell key={item.estado.id} fill={stateColor(item.estado.orden)}/>)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${Number(value)} ${Number(value) === 1 ? 'pedido' : 'pedidos'}`, name]} contentStyle={{ border: '1px solid #e2e9f2', borderRadius: 12, boxShadow: '0 8px 28px #082c4520' }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-total"><strong>{report.total_pedidos}</strong><span>pedidos</span></div>
            </div>
            <div className="status-chart-legend">{activeStates.map((item) => <div key={item.estado.id}><i style={{ backgroundColor: stateColor(item.estado.orden) }}/><span>{item.estado.nombre}</span><strong>{item.cantidad_pedidos}</strong></div>)}</div>
          </div>}
        </article>

        <article className="report-card status-detail-card">
          <header><div><h2>Detalle por estado</h2><p>Incluye estados sin pedidos</p></div><span className="report-card-icon"><CircleDot size={20}/></span></header>
          {report.pedidos_por_estado.length === 0 ? <div className="report-empty compact"><Layers3 size={38}/><b>No hay estados configurados</b></div> : <div className="status-detail-list">{report.pedidos_por_estado.map((item) => {
            const percentage = report.total_pedidos > 0 ? (item.cantidad_pedidos / report.total_pedidos) * 100 : 0
            return <div className="status-detail-row" key={item.estado.id}>
              <span className="status-color" style={{ backgroundColor: stateColor(item.estado.orden) }}/>
              <div><b>{item.estado.nombre}</b><span>{percentage.toLocaleString('es-GT', { maximumFractionDigits: 1 })}% del total</span></div>
              <strong>{item.cantidad_pedidos}</strong>
              <div className="status-progress"><i style={{ width: `${percentage}%`, backgroundColor: stateColor(item.estado.orden) }}/></div>
            </div>
          })}</div>}
        </article>
      </section>
    </>}
  </section>
}
