import { useEffect, useState } from 'react'
import { listInputs } from '../api/inventory'
import { getSupplyConsumptionReport } from '../api/reports'
import { Kpi, PanelHead, PeriodBar, ReportError, ReportHead } from '../components/admin/ReportKit'
import { qty, useCountUp, useReport } from '../hooks/useReport'
import type { Insumo } from '../types'
import { exportSupplyConsumptionReportPdf } from '../utils/reportPdf'
import '../styles/catalogs.css'
import '../styles/reports.css'

const svgIcon = (children: React.ReactNode, width = 1.9) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>

export function SupplyConsumptionReportPage() {
  const { period, report, loading, error, badRange, pick, setFrom, setTo, retry } = useReport(getSupplyConsumptionReport)
  const e = useCountUp(report)
  const [stock, setStock] = useState<Insumo[]>([])
  useEffect(() => {
    const controller = new AbortController()
    listInputs(controller.signal).then((items) => { if (!controller.signal.aborted) setStock(items ?? []) }).catch(() => undefined)
    return () => controller.abort()
  }, [])

  const items = (report?.consumo_por_insumo ?? []).filter((item) => item.cantidad_consumida > 0).sort((a, b) => b.cantidad_consumida - a.cantidad_consumida)
  const max = Math.max(1, ...items.map((item) => item.cantidad_consumida))
  const step = Math.max(1, Math.ceil(max / 4 / 3) * 3), top = step * 4
  const days = report ? Math.max(1, Math.round((new Date(report.fecha_fin.slice(0, 10)).getTime() - new Date(report.fecha_inicio.slice(0, 10)).getTime()) / 86400000) + 1) : 1
  const lead = items[0]
  const projItem = lead && stock.find((entry) => entry.id === lead.insumo_id)
  const proj = projItem && lead ? (() => {
    const rate = lead.cantidad_consumida / days
    const cap = Math.max(projItem.stock_minimo * 4, projItem.stock_actual * 1.25, 1)
    const left = rate > 0 ? Math.floor((projItem.stock_actual - projItem.stock_minimo) / rate) : null
    return { name: projItem.nombre, stock: `${qty(projItem.stock_actual)} ${projItem.unidad_medida}`, rate: `${qty(rate)} ${projItem.unidad_medida} por día`, days: left === null ? '—' : left <= 0 ? 'ya está en el mínimo' : `~${left} días`, lvl: Math.round(Math.max(0, projItem.stock_actual) / cap * 100), minPct: Math.round(projItem.stock_minimo / cap * 100) }
  })() : null

  return <section className="ct-page">
    <ReportHead title="Consumo de insumos" sub="Analiza las salidas de inventario registradas por período." onPdf={report ? () => exportSupplyConsumptionReportPdf(report) : undefined} />
    <PeriodBar period={period} badRange={badRange} onPick={pick} onFrom={setFrom} onTo={setTo} />
    {error && <ReportError message={error} onRetry={retry} />}
    <section className="rp-kp three">
      <Kpi dark delay={.22} iconBg="#FFC93C" iconFg="#0A2433" icon={svgIcon(<><path d="M9 3h6v4l3 3v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10l3-3z" /><path d="M6 14h12" /></>)} value={Math.round(items.length * e)} valueStyle={{ color: '#FFC93C' }} label="Insumos consumidos" sub="Con salidas en el período" />
      <Kpi delay={.26} iconBg="#E2F6EC" iconFg="#1F8A5B" icon={svgIcon(<path d="M3 12h4l3-8 4 16 3-8h4" />, 2)} value={Math.round((report?.cantidad_movimientos ?? 0) * e)} label="Movimientos de salida" sub="Registrados en el período" />
      <Kpi delay={.3} iconBg="#FFF0E4" iconFg="#B5541A" icon={svgIcon(<path d="M3 7l6 6 4-4 8 8M21 11v6h-6" />, 2)} value={lead ? `${qty(lead.cantidad_consumida * e)} ${lead.unidad_medida}` : '—'} label="Mayor consumo" sub={lead ? lead.nombre : 'Sin salidas'} />
    </section>
    <section className="rp-rg">
      <div className="rp-panel" style={{ animationDelay: '.34s' }}>
        <PanelHead title="Consumo por insumo" sub="Cantidad total utilizada durante el período"><span className="rp-legend1"><i />Cantidad consumida</span></PanelHead>
        {!report ? <div className="rp-loading" role="status">{loading ? 'Cargando reporte…' : 'Sin datos.'}</div>
          : items.length ? <div className="rp-hbars" role="img" aria-label={`Gráfica de consumo por insumo: ${items.map((item) => `${item.nombre}: ${qty(item.cantidad_consumida)} ${item.unidad_medida}`).join(', ')}`}>
            <div className="rp-axis" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ left: `${i * 25}%` }}>{step * i}</span>)}</div>
            {items.map((item, i) => <div key={item.insumo_id} className="rp-hb" style={{ animationDelay: `${(0.4 + i * 0.1).toFixed(2)}s` }}>
              <span className="rp-hbl">{item.nombre}</span>
              <div className="rp-hbt">{[0, 1, 2, 3, 4].map((t) => <i key={t} style={{ left: `${t * 25}%` }} />)}<span className="rp-hbf" style={{ width: `${Math.round(item.cantidad_consumida / top * 100)}%`, animationDelay: `${(0.6 + i * 0.1).toFixed(2)}s` }}><span className="rp-drops" aria-hidden="true" /><em>{qty(item.cantidad_consumida)} {item.unidad_medida}</em></span></div>
            </div>)}
          </div>
          : <div className="rp-emptyr">No hay salidas de inventario en este período.</div>}
      </div>
      <div className="rp-col">
        <div className="rp-panel" style={{ animationDelay: '.38s' }}>
          <PanelHead title="Detalle de consumo" sub="Cantidades según su unidad de medida" />
          {items.length ? items.map((item, i) => <div key={item.insumo_id} className="rp-mrow">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="rp-rk2">{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}><span className="ad-disp" style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{item.nombre}</span><span style={{ fontSize: 13, color: '#5A7280' }}>{item.unidad_medida} · {item.cantidad_movimientos} {item.cantidad_movimientos === 1 ? 'movimiento' : 'movimientos'}</span></span>
              <span className="ad-disp" style={{ fontSize: 20, fontWeight: 800 }}>{qty(item.cantidad_consumida)} {item.unidad_medida}</span>
            </div>
            <div className="rp-mbar"><span style={{ width: `${Math.round(item.cantidad_consumida / max * 100)}%`, background: '#0E9BD6' }} /></div>
          </div>) : <p style={{ margin: 0, color: '#5A7280' }}>Sin datos.</p>}
        </div>
        {proj && <div className="rp-panel projc" style={{ animationDelay: '.42s' }}>
          <PanelHead title={`Proyección · ${proj.name}`} sub="Estimado con el ritmo del período" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div className="rp-tank3" aria-hidden="true"><div className="rp-lv3" style={{ height: `${proj.lvl}%` }}><svg viewBox="0 0 400 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q 25 0 50 7 T 100 7 T 150 7 T 200 7 T 250 7 T 300 7 T 350 7 T 400 7 V14 H0 Z" fill="#5BC3EC" /></svg></div><span className="rp-mn3" style={{ bottom: `${proj.minPct}%` }} /></div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#A9C1CD' }}>Stock actual</p>
              <p className="ad-disp" style={{ margin: '2px 0 10px', fontSize: 30, fontWeight: 800, color: '#FFC93C', lineHeight: 1 }}>{proj.stock}</p>
              <p style={{ margin: 0, fontSize: 14 }}>Ritmo: <b>{proj.rate}</b></p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Llega al mínimo en <b style={{ color: '#FFC93C' }}>{proj.days}</b></p>
            </div>
          </div>
        </div>}
      </div>
    </section>
  </section>
}
