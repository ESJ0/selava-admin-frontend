import { Activity, CalendarDays, ChartBarBig, PackageSearch, RefreshCw, Scale, TrendingDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { errorMessage } from '../api/client'
import { getSupplyConsumptionReport } from '../api/reports'
import type { ReporteConsumoInsumoDetalle, ReporteConsumoInsumos } from '../types'

interface Periodo {
  inicio: string
  fin: string
}

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

function dateFromApi(value: string) {
  return new Date(`${value}T12:00:00`)
}

const longDate = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })
const quantity = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 })

function formatLongDate(value: string) {
  return longDate.format(dateFromApi(value))
}

function formatQuantity(value: number, unit: string) {
  return `${quantity.format(value)} ${unit}`
}

export function SupplyConsumptionReportPage() {
  const [filters, setFilters] = useState<Periodo>(initialPeriod)
  const [appliedPeriod, setAppliedPeriod] = useState<Periodo>(initialPeriod)
  const [report, setReport] = useState<ReporteConsumoInsumos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const request = useRef<AbortController | null>(null)

  const load = useCallback(async (period: Periodo) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setAppliedPeriod(period)
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const response = await getSupplyConsumptionReport(period.inicio, period.fin, controller.signal)
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

  const consumed = useMemo(() => report?.consumo_por_insumo
    .filter((item) => item.cantidad_consumida > 0)
    .sort((left, right) => right.cantidad_consumida - left.cantidad_consumida) ?? [], [report])
  const leading = useMemo(() => consumed.reduce<ReporteConsumoInsumoDetalle | null>((current, item) => !current || item.cantidad_consumida > current.cantidad_consumida ? item : current, null), [consumed])

  return <section className="report-page supply-consumption-report-page">
    <header className="page-heading report-heading">
      <div><h1>Consumo de insumos</h1><p>Analiza las salidas de inventario registradas por período.</p></div>
    </header>

    <form className="report-filters" aria-label="Filtros del reporte de consumo de insumos" onSubmit={submit}>
      <div className="report-filter-title"><span><CalendarDays size={21}/></span><div><b>Período del reporte</b><small>Selecciona un rango de fechas</small></div></div>
      <label>Desde<input aria-label="Fecha de inicio" type="date" required value={filters.inicio} onChange={(event) => setFilters((current) => ({ ...current, inicio: event.target.value }))}/></label>
      <label>Hasta<input aria-label="Fecha final" type="date" required value={filters.fin} onChange={(event) => setFilters((current) => ({ ...current, fin: event.target.value }))}/></label>
      <button className="primary" type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Aplicar filtro'}</button>
    </form>

    {validationError && <div className="alert error" role="alert">{validationError}</div>}
    {error && <div className="alert error" role="alert"><span>{error}</span><button type="button" onClick={() => void load(appliedPeriod)}><RefreshCw size={16}/>Reintentar</button></div>}

    {loading ? <div className="report-loading" role="status"><span className="spinner"/>Generando reporte…</div> : report && <>
      <div className="report-period-label">Resultados del {formatLongDate(report.fecha_inicio)} al {formatLongDate(report.fecha_fin)}</div>
      <section className="report-metrics supply-consumption-metrics" aria-label="Resumen de consumo de insumos">
        <article><span className="metric-icon sales"><PackageSearch size={23}/></span><div><small>Insumos consumidos</small><strong>{consumed.length}</strong><span>Con salidas en el período</span></div></article>
        <article><span className="metric-icon payments"><Activity size={23}/></span><div><small>Movimientos de salida</small><strong>{report.cantidad_movimientos}</strong><span>Registrados en el período</span></div></article>
        <article><span className="metric-icon average"><TrendingDown size={23}/></span><div><small>Mayor consumo</small><strong>{leading ? formatQuantity(leading.cantidad_consumida, leading.unidad_medida) : 'Sin consumo'}</strong><span>{leading?.nombre ?? 'No hay salidas registradas'}</span></div></article>
      </section>

      <section className="supply-consumption-grid">
        <article className="report-card consumption-chart-card">
          <header><div><h2>Consumo por insumo</h2><p>Cantidad total utilizada durante el período</p></div><span className="chart-legend"><i/>Cantidad consumida</span></header>
          {consumed.length === 0 ? <div className="report-empty"><ChartBarBig size={42}/><b>No hay consumo en este período</b><span>Prueba seleccionando otro rango de fechas.</span></div> : <div className="consumption-chart" style={{ height: Math.max(370, consumed.length * 58) }} role="img" aria-label="Gráfica de consumo de insumos por período">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumed} layout="vertical" margin={{ top: 8, right: 30, left: 16, bottom: 8 }}>
                <CartesianGrid stroke="#e8eef5" strokeDasharray="4 4" horizontal={false}/>
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#7890aa', fontSize: 12 }}/>
                <YAxis type="category" dataKey="nombre" width={118} axisLine={false} tickLine={false} tick={{ fill: '#526b86', fontSize: 12 }}/>
                <Tooltip formatter={(value, _name, item) => [formatQuantity(Number(value), (item.payload as ReporteConsumoInsumoDetalle).unidad_medida), 'Consumo']} contentStyle={{ border: '1px solid #e2e9f2', borderRadius: 12, boxShadow: '0 8px 28px #082c4520' }}/>
                <Bar dataKey="cantidad_consumida" name="Consumo" fill="#05aff2" radius={[0, 7, 7, 0]} maxBarSize={38}/>
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </article>

        <article className="report-card consumption-detail-card">
          <header><div><h2>Detalle de consumo</h2><p>Cantidades según su unidad de medida</p></div><span className="report-card-icon"><Scale size={20}/></span></header>
          {consumed.length === 0 ? <div className="report-empty compact"><PackageSearch size={38}/><b>Sin salidas registradas</b></div> : <div className="consumption-detail-list">{consumed.map((item, index) => {
            const relative = leading ? (item.cantidad_consumida / leading.cantidad_consumida) * 100 : 0
            return <div className="consumption-detail-row" key={item.insumo_id}>
              <span className="consumption-rank">{index + 1}</span>
              <div><b>{item.nombre}</b><span>{item.unidad_medida} · {item.cantidad_movimientos} {item.cantidad_movimientos === 1 ? 'movimiento' : 'movimientos'}</span></div>
              <strong>{formatQuantity(item.cantidad_consumida, item.unidad_medida)}</strong>
              <div className="consumption-progress"><i style={{ width: `${relative}%` }}/></div>
            </div>
          })}</div>}
        </article>
      </section>
    </>}
  </section>
}
