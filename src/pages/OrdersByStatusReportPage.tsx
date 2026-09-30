import { ChartPie, CircleDot, ClipboardList, Layers3, RefreshCw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { errorMessage } from '../api/client'
import { getOrdersByStatusReport } from '../api/reports'
import type { ReportePedidosPorEstado } from '../types'

const STATUS_COLORS = ['#05aff2', '#7357d9', '#00b87b', '#f4a340', '#e85b6b', '#58708f']

function statusColor(index: number) {
  return STATUS_COLORS[index % STATUS_COLORS.length]
}

function stateColor(order: number) {
  return statusColor(Math.max(0, order - 1))
}

export function OrdersByStatusReportPage() {
  const [report, setReport] = useState<ReportePedidosPorEstado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const response = await getOrdersByStatusReport(controller.signal)
      if (!controller.signal.aborted) setReport(response)
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])

  const activeStates = useMemo(() => report?.pedidos_por_estado.filter((item) => item.cantidad_pedidos > 0) ?? [], [report])
  const leadingState = useMemo(() => activeStates.reduce<(typeof activeStates)[number] | null>((leading, item) => !leading || item.cantidad_pedidos > leading.cantidad_pedidos ? item : leading, null), [activeStates])

  return <section className="report-page order-status-report-page">
    <header className="page-heading report-heading">
      <div><h1>Pedidos por estado</h1><p>Visualiza la distribución actual de los pedidos activos.</p></div>
      <button className="secondary report-refresh" type="button" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? 'spinning' : ''} size={18}/>{loading ? 'Actualizando…' : 'Actualizar'}</button>
    </header>

    {error && <div className="alert error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}><RefreshCw size={16}/>Reintentar</button></div>}

    {loading ? <div className="report-loading" role="status"><span className="spinner"/>Generando reporte…</div> : report && <>
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
