import { CalendarDays, ChartColumnBig, CircleDollarSign, CreditCard, ReceiptText, RefreshCw, ShoppingBag } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { errorMessage } from '../api/client'
import { getSalesReport } from '../api/reports'
import type { ReporteVentas } from '../types'

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

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const wholeCurrency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 0 })
const shortDate = new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short' })
const longDate = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })

function formatCurrency(value: number) {
  return currency.format(value)
}

function formatShortDate(value: string) {
  return shortDate.format(dateFromApi(value))
}

function formatLongDate(value: string) {
  return longDate.format(dateFromApi(value))
}

export function SalesReportPage() {
  const [filters, setFilters] = useState<Periodo>(initialPeriod)
  const [appliedPeriod, setAppliedPeriod] = useState<Periodo>(initialPeriod)
  const [report, setReport] = useState<ReporteVentas | null>(null)
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
      const response = await getSalesReport(period.inicio, period.fin, controller.signal)
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

  const average = report && report.cantidad_ventas > 0 ? report.total_ventas / report.cantidad_ventas : 0

  return <section className="report-page sales-report-page">
    <header className="page-heading report-heading">
      <div><h1>Reporte de ventas</h1><p>Consulta el comportamiento de tus ventas por período.</p></div>
    </header>

    <form className="report-filters" aria-label="Filtros del reporte de ventas" onSubmit={submit}>
      <div className="report-filter-title"><span><CalendarDays size={21}/></span><div><b>Período del reporte</b><small>Selecciona un rango de fechas</small></div></div>
      <label>Desde<input aria-label="Fecha de inicio" type="date" required value={filters.inicio} onChange={(event) => setFilters((current) => ({ ...current, inicio: event.target.value }))}/></label>
      <label>Hasta<input aria-label="Fecha final" type="date" required value={filters.fin} onChange={(event) => setFilters((current) => ({ ...current, fin: event.target.value }))}/></label>
      <button className="primary" type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Aplicar filtro'}</button>
    </form>

    {validationError && <div className="alert error" role="alert">{validationError}</div>}
    {error && <div className="alert error" role="alert"><span>{error}</span><button type="button" onClick={() => void load(appliedPeriod)}><RefreshCw size={16}/>Reintentar</button></div>}

    {loading ? <div className="report-loading" role="status"><span className="spinner"/>Generando reporte…</div> : report && <>
      <div className="report-period-label">Resultados del {formatLongDate(report.fecha_inicio)} al {formatLongDate(report.fecha_fin)}</div>
      <section className="report-metrics sales-metrics" aria-label="Resumen de ventas">
        <article><span className="metric-icon sales"><CircleDollarSign size={23}/></span><div><small>Total vendido</small><strong>{formatCurrency(report.total_ventas)}</strong><span>Ingresos del período</span></div></article>
        <article><span className="metric-icon orders"><ShoppingBag size={23}/></span><div><small>Ventas</small><strong>{report.cantidad_ventas}</strong><span>Pedidos con al menos un pago</span></div></article>
        <article><span className="metric-icon payments"><ReceiptText size={23}/></span><div><small>Pagos recibidos</small><strong>{report.cantidad_pagos}</strong><span>Transacciones registradas</span></div></article>
        <article><span className="metric-icon average"><ChartColumnBig size={23}/></span><div><small>Promedio por venta</small><strong>{formatCurrency(average)}</strong><span>Ingreso promedio por pedido</span></div></article>
      </section>

      <section className="report-grid">
        <article className="report-card sales-chart-card">
          <header><div><h2>Ventas por día</h2><p>Monto recibido diariamente</p></div><span className="chart-legend"><i/>Ventas</span></header>
          {report.ventas_por_dia.length === 0 ? <div className="report-empty"><ChartColumnBig size={42}/><b>No hay ventas en este período</b><span>Prueba seleccionando otro rango de fechas.</span></div> : <div className="sales-chart" role="img" aria-label="Gráfica de ventas por día">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={report.ventas_por_dia} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#05aff2" stopOpacity={0.3}/><stop offset="100%" stopColor="#05aff2" stopOpacity={0.02}/></linearGradient></defs>
                <CartesianGrid stroke="#e8eef5" strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="fecha" tickFormatter={formatShortDate} axisLine={false} tickLine={false} tick={{ fill: '#7890aa', fontSize: 12 }} minTickGap={28}/>
                <YAxis tickFormatter={(value) => wholeCurrency.format(Number(value))} axisLine={false} tickLine={false} tick={{ fill: '#7890aa', fontSize: 12 }} width={76}/>
                <Tooltip labelFormatter={(label) => formatLongDate(String(label))} formatter={(value) => [formatCurrency(Number(value)), 'Ventas']} contentStyle={{ border: '1px solid #e2e9f2', borderRadius: 12, boxShadow: '0 8px 28px #082c4520' }}/>
                <Area type="monotone" dataKey="total_ventas" name="Ventas" stroke="#05aff2" strokeWidth={3} fill="url(#salesFill)" activeDot={{ r: 5, fill: '#05aff2', stroke: '#fff', strokeWidth: 2 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>}
        </article>

        <article className="report-card payment-methods-card">
          <header><div><h2>Métodos de pago</h2><p>Distribución de ingresos</p></div><span className="report-card-icon"><CreditCard size={20}/></span></header>
          {report.ventas_por_metodo_pago.length === 0 ? <div className="report-empty compact"><CreditCard size={38}/><b>Sin pagos registrados</b></div> : <div className="payment-method-list">{report.ventas_por_metodo_pago.map((item) => {
            const percentage = report.total_ventas > 0 ? (item.total_ventas / report.total_ventas) * 100 : 0
            return <div key={item.metodo_pago.id} className="payment-method-row">
              <div><b>{item.metodo_pago.nombre}</b><span>{item.cantidad_pagos} {item.cantidad_pagos === 1 ? 'pago' : 'pagos'}</span></div><strong>{formatCurrency(item.total_ventas)}</strong>
              <div className="payment-share"><i style={{ width: `${percentage}%` }}/></div><small>{percentage.toLocaleString('es-GT', { maximumFractionDigits: 1 })}%</small>
            </div>
          })}</div>}
        </article>
      </section>
    </>}
  </section>
}
