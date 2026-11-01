import { useState } from 'react'
import { getOrdersByStatusReport } from '../api/reports'
import { Insight, Kpi, PanelHead, PeriodBar, ReportError, ReportHead } from '../components/admin/ReportKit'
import { useCountUp, useReport } from '../hooks/useReport'
import { exportOrdersByStatusReportPdf } from '../utils/reportPdf'
import '../styles/catalogs.css'
import '../styles/reports.css'

const FALLBACK = ['#F5A33A', '#7B5CE0', '#3E5866', '#FFC93C', '#0E9BD6', '#1F8A5B', '#C8401F', '#C9B8FF']
function stateColor(name: string, index: number) {
  const n = name.toLowerCase()
  if (n.includes('recib')) return '#F5A33A'
  if (n.includes('seco')) return '#3E5866'
  if (n.includes('lavad')) return '#7B5CE0'
  if (n.includes('planch')) return '#FFC93C'
  if (n.includes('rack')) return '#0E9BD6'
  if (n.includes('final') || n.includes('entreg')) return '#1F8A5B'
  if (n.includes('cancel')) return '#C8401F'
  return FALLBACK[index % FALLBACK.length]
}
const svgIcon = (children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>

export function OrdersByStatusReportPage() {
  const { period, report, loading, error, badRange, pick, setFrom, setTo, retry } = useReport(getOrdersByStatusReport)
  const e = useCountUp(report)
  const [hover, setHover] = useState('')
  const states = (report?.pedidos_por_estado ?? []).slice().sort((a, b) => (a.estado.orden ?? 0) - (b.estado.orden ?? 0)).map((item, i) => ({ id: item.estado.id, name: item.estado.nombre, n: item.cantidad_pedidos, color: stateColor(item.estado.nombre, i) }))
  const total = report?.total_pedidos ?? states.reduce((sum, item) => sum + item.n, 0)
  const withN = states.filter((item) => item.n > 0)
  const top = withN.slice().sort((a, b) => b.n - a.n)[0]
  const pct = (n: number) => total ? Math.round(n / total * 1000) / 10 : 0
  const C = 2 * Math.PI * 96, gap = withN.length > 1 ? 4 : 0
  const lengths = withN.map((item) => item.n / Math.max(1, total) * C)
  const arcs = withN.map((item, i) => ({ ...item, dash: `${Math.max(0, lengths[i] - gap).toFixed(1)} ${C.toFixed(1)}`, off: (-lengths.slice(0, i).reduce((sum, len) => sum + len, 0)).toFixed(1), d: (0.3 + i * 0.15).toFixed(2) }))
  const hv = withN.find((item) => item.name === hover)
  const leave = () => setHover('')

  return <section className="ct-page">
    <ReportHead title="Pedidos por estado" sub="Visualiza la distribución actual de los pedidos activos." onPdf={report ? () => exportOrdersByStatusReportPdf(report) : undefined} />
    <PeriodBar period={period} badRange={badRange} onPick={pick} onFrom={setFrom} onTo={setTo} />
    {error && <ReportError message={error} onRetry={retry} />}
    <section className="rp-kp three">
      <Kpi dark delay={.22} iconBg="#FFC93C" iconFg="#0A2433" icon={svgIcon(<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>)} value={Math.round(total * e)} valueStyle={{ color: '#FFC93C' }} label="Pedidos activos" sub="Total incluido en el reporte" />
      <Kpi delay={.26} iconBg="#EFE9FF" iconFg="#5B3FCF" icon={svgIcon(<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />)} value={Math.round(withN.length * e)} label="Estados con pedidos" sub={`De ${states.length} estados registrados`} />
      <Kpi delay={.3} iconBg="#FFF4D6" iconFg="#9A6A00" icon={svgIcon(<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />)} value={top ? top.name : '—'} valueStyle={{ fontSize: 32 }} label="Estado predominante" sub={`${top?.n ?? 0} pedidos · ${top ? Math.round(pct(top.n)) : 0}% del total`} />
    </section>
    <section className="rp-rg" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' }}>
      <div className="rp-panel" style={{ animationDelay: '.34s' }}>
        <PanelHead title="Distribución de pedidos" sub="Pasa el mouse por un estado para resaltarlo" />
        {!report ? <div className="rp-loading" role="status">{loading ? 'Cargando reporte…' : 'Sin datos.'}</div>
          : total === 0 ? <div className="rp-emptyr">No hay pedidos activos en este período.</div>
          : <>
            <div className="rp-donutwrap">
              <svg viewBox="0 0 260 260" className="rp-donut" role="img" aria-label={`Gráfica de pedidos por estado: ${withN.map((item) => `${item.name}: ${item.n}`).join(', ')}`}>
                <circle cx="130" cy="130" r="96" fill="none" stroke="#EEF3F6" strokeWidth="34" />
                {arcs.map((arc) => <circle key={arc.id} className={`rp-arc${hover && hover !== arc.name ? ' dimmed' : ''}`} cx="130" cy="130" r="96" fill="none" stroke={arc.color} strokeWidth={hover === arc.name ? 44 : 34} strokeDasharray={arc.dash} strokeDashoffset={arc.off} transform="rotate(-90 130 130)" style={{ animationDelay: `${arc.d}s` }} onMouseEnter={() => setHover(arc.name)} onMouseLeave={leave} />)}
              </svg>
              <div className="rp-dcenter"><span className="ad-disp" style={{ fontSize: 54, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: hv ? hv.color : '#0A2433' }}>{hv ? hv.n : Math.round(total * e)}</span><span style={{ fontSize: 14, color: '#5A7280' }}>{hv ? `${hv.name} · ${pct(hv.n)}%` : 'pedidos activos'}</span></div>
            </div>
            <div className="rp-legend">{withN.map((item) => <button key={item.id} type="button" className={`rp-lgb${hover === item.name ? ' on' : ''}`} onMouseEnter={() => setHover(item.name)} onMouseLeave={leave} onFocus={() => setHover(item.name)} onBlur={leave}><i style={{ background: item.color }} />{item.name}<strong>{item.n}</strong></button>)}</div>
          </>}
      </div>
      <div className="rp-panel" style={{ animationDelay: '.38s' }}>
        <PanelHead title="Detalle por estado" sub="Incluye estados sin pedidos, en orden del proceso" />
        {states.length ? <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {states.map((item, i) => <li key={item.id} className={`rp-srow${item.n ? '' : ' zero'}${hover === item.name ? ' on' : ''}`} style={{ animationDelay: `${(0.4 + i * 0.05).toFixed(2)}s` }} onMouseEnter={() => { if (item.n) setHover(item.name) }} onMouseLeave={leave}>
            <span className="rp-stn2" style={{ background: item.n ? item.color : '#EEF3F6', color: item.n ? '#fff' : '#8AA3B0' }}>{i + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}><span style={{ fontWeight: 600 }}>{item.name}</span><span><span className="ad-disp" style={{ fontSize: 22, fontWeight: 800 }}>{item.n}</span> <span style={{ fontSize: 12, color: '#5A7280' }}>{pct(item.n)}%</span></span></div>
              <div className="rp-mbar" style={{ marginTop: 8 }}><span style={{ width: `${pct(item.n)}%`, background: item.color }} /></div>
            </div>
          </li>)}
        </ol> : <p style={{ margin: 0, color: '#5A7280' }}>Sin datos.</p>}
        {top && pct(top.n) >= 60 && <Insight icon="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v6M12 16.5v.5">El <b>{Math.round(pct(top.n))}%</b> de los pedidos sigue en <b>{top.name}</b>. Puede ser un buen momento para avanzarlos a la siguiente etapa.</Insight>}
      </div>
    </section>
  </section>
}
