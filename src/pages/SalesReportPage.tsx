import { getSalesReport } from '../api/reports'
import { Insight, Kpi, PanelHead, PeriodBar, ReportError, ReportHead } from '../components/admin/ReportKit'
import { dashDay, qMoney, useCountUp, useReport, weekdayDay } from '../hooks/useReport'
import type { ReporteVentas } from '../types'
import { exportSalesReportPdf } from '../utils/reportPdf'
import '../styles/catalogs.css'
import '../styles/reports.css'

const METHOD_COLORS = ['#0E9BD6', '#FFC93C', '#7EE0B5', '#C9B8FF']
const svgIcon = (children: React.ReactNode, width = 1.9) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>

/** Curva suave sin sobrepasar los puntos (igual que el diseño). */
function smooth(points: [number, number][]) {
  if (points.length < 2) return points.length ? `M${points[0][0]} ${points[0][1]}` : ''
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), clamp = (y: number) => Math.max(lo, Math.min(hi, y))
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)], c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

function SalesChart({ report }: { report: ReporteVentas }) {
  const days = report.ventas_por_dia.filter((day) => day.total_ventas > 0).slice().sort((a, b) => a.fecha.localeCompare(b.fecha))
  const max = Math.max(1, ...days.map((day) => day.total_ventas))
  const nice = Math.ceil(max / 75) * 75
  const t0 = new Date(`${report.fecha_inicio.slice(0, 10)}T12:00`).getTime(), t1 = new Date(`${report.fecha_fin.slice(0, 10)}T12:00`).getTime()
  const X = (value: string) => days.length === 1 ? 400 : 80 + ((new Date(`${value.slice(0, 10)}T12:00`).getTime() - t0) / Math.max(1, t1 - t0)) * 640
  const Y = (value: number) => 280 - (value / nice) * 250
  const points = days.map((day) => [X(day.fecha), Y(day.total_ventas)] as [number, number])
  const line = smooth(points)
  const area = points.length ? `${line} L${points[points.length - 1][0].toFixed(1)} 280 L${points[0][0].toFixed(1)} 280 Z` : ''
  return <svg viewBox="0 0 760 320" className="rp-chart" role="img" aria-label="Gráfica de ventas por día">
    <defs><linearGradient id="rp-vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0E9BD6" stopOpacity=".32" /><stop offset="1" stopColor="#0E9BD6" stopOpacity="0" /></linearGradient></defs>
    {[0, 1, 2, 3, 4].map((i) => <g key={i}>
      <line x1="60" x2="740" y1={280 - i * 62.5} y2={280 - i * 62.5} stroke="#E6EEF2" strokeDasharray="4 6" />
      <text x="50" y={284 - i * 62.5} textAnchor="end" fontSize="12" fill="#5A7280" fontFamily="Instrument Sans, sans-serif">Q{Math.round(nice / 4 * i)}</text>
    </g>)}
    <path className="rp-areaf" d={area} fill="url(#rp-vg)" />
    <path className="rp-draw" d={line} fill="none" stroke="#0E9BD6" strokeWidth="3.5" strokeLinecap="round" />
    {days.map((day, i) => {
      const [x, y] = points[i]
      const tx = Math.max(60, Math.min(620, x - 60)), ty = y > 90 ? y - 62 : y + 14
      const label = `${dashDay(day.fecha)}: ${qMoney(day.total_ventas)}`
      return <g key={day.fecha} className="rp-pt" tabIndex={0} aria-label={label}>
        <line x1={x} x2={x} y1={y} y2="280" stroke="#BFE6F7" strokeWidth="1.5" strokeDasharray="3 4" />
        <circle cx={x} cy={y} r="16" fill="transparent" />
        <circle className="dot" cx={x} cy={y} r="6" fill="#fff" stroke="#0A2433" strokeWidth="3" />
        <text x={x} y="302" textAnchor="middle" fontSize="12" fill="#5A7280" fontFamily="Instrument Sans, sans-serif">{dashDay(day.fecha)}</text>
        <g className="tip" aria-hidden="true"><rect x={tx} y={ty} width="120" height="48" rx="12" fill="#0A2433" />
          <text x={tx + 60} y={ty + 22} textAnchor="middle" fontSize="16" fontWeight="800" fill="#FFC93C" fontFamily="Bricolage Grotesque, sans-serif">{qMoney(day.total_ventas)}</text>
          <text x={tx + 60} y={ty + 38} textAnchor="middle" fontSize="11" fill="#A9C1CD" fontFamily="Instrument Sans, sans-serif">{day.cantidad_pagos} {day.cantidad_pagos === 1 ? 'pago' : 'pagos'}</text></g>
      </g>
    })}
  </svg>
}

export function SalesReportPage() {
  const { period, report, loading, error, badRange, pick, setFrom, setTo, retry } = useReport(getSalesReport)
  const e = useCountUp(report)
  const days = (report?.ventas_por_dia ?? []).filter((day) => day.total_ventas > 0)
  const methods = (report?.ventas_por_metodo_pago ?? []).filter((item) => item.total_ventas > 0)
  const total = report?.total_ventas ?? 0, sales = report?.cantidad_ventas ?? 0, pays = report?.cantidad_pagos ?? 0
  const bestValue = Math.max(0, ...days.map((day) => day.total_ventas))
  const best = days.filter((day) => day.total_ventas === bestValue).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const rows = days.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))

  return <section className="ct-page">
    <ReportHead title="Reporte de ventas" sub="Consulta el comportamiento de tus ventas por período." onPdf={report ? () => exportSalesReportPdf(report) : undefined} />
    <PeriodBar period={period} badRange={badRange} onPick={pick} onFrom={setFrom} onTo={setTo} />
    {error && <ReportError message={error} onRetry={retry} />}
    <section className="rp-kp">
      <Kpi dark delay={.22} iconBg="#FFC93C" iconFg="#0A2433" icon={svgIcon(<><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.4-1-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.9 2.5 2-1 2-2.5 2c-1.2 0-2.2-.6-2.6-1.6M12 6.5v11" /></>, 2)} value={qMoney(total * e)} valueStyle={{ color: '#FFC93C' }} label="Total vendido" sub="Ingresos del período" />
      <Kpi delay={.26} iconBg="#DDF1FA" iconFg="#06709F" icon={svgIcon(<><path d="M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8z" /><path d="M9 7a3 3 0 0 1 6 0" /></>)} value={Math.round(sales * e)} label="Ventas" sub="Pedidos con al menos un pago" />
      <Kpi delay={.3} iconBg="#E2F6EC" iconFg="#1F8A5B" icon={svgIcon(<><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></>)} value={Math.round(pays * e)} label="Pagos recibidos" sub="Transacciones registradas" />
      <Kpi delay={.34} iconBg="#FFF4D6" iconFg="#9A6A00" icon={svgIcon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)} value={sales ? qMoney(total / sales * e) : 'Q 0.00'} label="Promedio por venta" sub="Ingreso promedio por pedido" />
    </section>
    <section className="rp-rg">
      <div className="rp-panel" style={{ animationDelay: '.38s' }}>
        <PanelHead title="Ventas por día" sub="Monto recibido diariamente · pasa el mouse por los puntos"><span className="rp-legend1"><i />Ventas</span></PanelHead>
        {!report ? <div className="rp-loading" role="status">{loading ? 'Cargando reporte…' : 'Sin datos.'}</div>
          : days.length ? <SalesChart key={`${report.fecha_inicio}-${report.fecha_fin}`} report={report} />
          : <div className="rp-emptyr">No hay pagos en este período.</div>}
      </div>
      <div className="rp-col">
        <div className="rp-panel" style={{ animationDelay: '.42s' }}>
          <PanelHead title="Métodos de pago" sub="Distribución de ingresos" />
          {methods.length ? methods.map((item, i) => {
            const pct = total ? Math.round(item.total_ventas / total * 100) : 0
            return <div key={item.metodo_pago.id} className="rp-mrow">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span><span className="ad-disp" style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{item.metodo_pago.nombre}</span><span style={{ fontSize: 13, color: '#5A7280' }}>{item.cantidad_pagos} {item.cantidad_pagos === 1 ? 'pago' : 'pagos'}</span></span>
                <span style={{ textAlign: 'right' }}><span className="ad-disp" style={{ display: 'block', fontSize: 20, fontWeight: 800 }}>{qMoney(item.total_ventas)}</span><span style={{ fontSize: 13, color: '#5A7280' }}>{pct}%</span></span>
              </div>
              <div className="rp-mbar"><span style={{ width: `${pct}%`, background: METHOD_COLORS[i % 4] }} /></div>
            </div>
          }) : <p style={{ margin: 0, color: '#5A7280' }}>Sin datos.</p>}
        </div>
        <div className="rp-panel" style={{ animationDelay: '.46s' }}>
          <PanelHead title="Lo destacado" sub="Calculado del período" />
          {days.length ? <>
            <Insight icon="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z">{best.length > 1 ? 'Mejores días:' : 'Mejor día:'} <b>{best.map((day) => dashDay(day.fecha)).join(' y ')}</b> con {qMoney(bestValue)}{best.length > 1 ? ' cada uno.' : '.'}</Insight>
            <Insight icon="M3 12h4l3-8 4 16 3-8h4">Hubo ventas en <b>{days.length} {days.length === 1 ? 'día' : 'días'}</b> del período.</Insight>
            <Insight icon="M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8zM9 7a3 3 0 0 1 6 0">Cada venta tuvo en promedio <b>{(pays / Math.max(1, sales)).toFixed(1)} pagos</b> (abonos incluidos).</Insight>
          </> : <p style={{ margin: 0, color: '#5A7280' }}>Sin datos.</p>}
        </div>
      </div>
    </section>
    <section className="rp-panel" style={{ marginTop: 18, animationDelay: '.5s' }}>
      <PanelHead title="Pagos del período" sub={`${pays} ${pays === 1 ? 'pago registrado' : 'pagos registrados'}`} />
      {rows.length ? rows.map((day, i) => <div key={day.fecha} className="rp-prow" style={{ animationDelay: `${(0.04 * Math.min(i, 12) + 0.5).toFixed(2)}s` }}>
        <span className="ad-disp" style={{ fontWeight: 800 }}>{weekdayDay(day.fecha)}</span>
        <span style={{ fontWeight: 600 }}>{day.cantidad_ventas} {day.cantidad_ventas === 1 ? 'venta' : 'ventas'}</span>
        <span className="ct-stb" style={{ background: '#E2F6EC', color: '#1F8A5B', justifySelf: 'start' }}><i />{day.cantidad_pagos} {day.cantidad_pagos === 1 ? 'pago' : 'pagos'}</span>
        <span className="ad-disp" style={{ textAlign: 'right', fontWeight: 800, color: '#06709F' }}>+ {qMoney(day.total_ventas)}</span>
      </div>) : <p style={{ margin: 0, color: '#5A7280' }}>{report ? 'Sin pagos registrados.' : 'Sin datos.'}</p>}
    </section>
  </section>
}
