import type { jsPDF as JsPdf } from 'jspdf'
import type { ReporteConsumoInsumos, ReportePedidosPorEstado, ReporteVentas } from '../types'

/* Paleta de SELAVA (misma del panel). */
type Rgb = [number, number, number]
const NAVY: Rgb = [10, 36, 51]
const NAVY_2: Rgb = [18, 58, 80]
const SKY: Rgb = [14, 155, 214]
const YELLOW: Rgb = [255, 201, 60]
const GREEN: Rgb = [31, 138, 91]
const INK: Rgb = [10, 36, 51]
const MUTED: Rgb = [90, 114, 128]
const LINE: Rgb = [220, 231, 236]
const PAPER: Rgb = [244, 248, 250]
const STATE_COLORS: Rgb[] = [[245, 163, 58], [123, 92, 224], [62, 88, 102], [255, 201, 60], [14, 155, 214], [31, 138, 91], [200, 64, 31], [201, 184, 255]]

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const number = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 })
const longDate = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })
const generatedAt = new Intl.DateTimeFormat('es-GT', { dateStyle: 'long', timeStyle: 'short' })
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

type Summary = { label: string; value: string; accent?: Rgb }
type Table = { title: string; head: string[]; body: Array<Array<string | number>>; foot?: Array<string | number>; align?: Array<'left' | 'right' | 'center'> }
type Bar = { label: string; value: number; display: string; color?: Rgb }
type Chart = { title: string; subtitle: string; kind: 'columns' | 'rows'; bars: Bar[] }
type Doc = JsPdf & { lastAutoTable: { finalY: number } }

const parseDay = (value: string) => { const [y, m, d] = value.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
const dateLabel = (value: string) => longDate.format(parseDay(value))

let logoCache: Promise<string | null> | null = null
/** Carga el logotipo de SELAVA como data URL (una sola vez); si falla, el PDF se genera sin él. */
function loadLogo() {
  logoCache ??= fetch('/selava-logo.png')
    .then((response) => response.ok ? response.blob() : Promise.reject(new Error('logo')))
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    }))
    .catch(() => { logoCache = null; return null })
  return logoCache
}

const fill = (doc: JsPdf, color: Rgb) => doc.setFillColor(color[0], color[1], color[2])
const stroke = (doc: JsPdf, color: Rgb) => doc.setDrawColor(color[0], color[1], color[2])
const ink = (doc: JsPdf, color: Rgb) => doc.setTextColor(color[0], color[1], color[2])
const font = (doc: JsPdf, size: number, weight: 'normal' | 'bold' = 'normal') => { doc.setFont('helvetica', weight); doc.setFontSize(size) }

function drawHeader(doc: JsPdf, title: string, start: string, end: string, logo: string | null) {
  const width = doc.internal.pageSize.getWidth()
  fill(doc, NAVY)
  doc.rect(0, 0, width, 46, 'F')
  // Círculos decorativos, como las burbujas del panel.
  fill(doc, NAVY_2)
  doc.circle(width - 18, 6, 26, 'F')
  doc.circle(width - 30, 40, 6, 'F')
  fill(doc, SKY)
  doc.circle(width - 40, 14, 2.2, 'F')
  fill(doc, YELLOW)
  doc.rect(0, 46, width, 2.2, 'F')

  // Logotipo sobre tarjeta blanca.
  fill(doc, [255, 255, 255])
  doc.roundedRect(14, 8, 40, 31, 4, 4, 'F')
  if (logo) doc.addImage(logo, 'PNG', 16.5, 10, 35, 26.8)
  else { font(doc, 14, 'bold'); ink(doc, NAVY); doc.text('SELAVA', 34, 26, { align: 'center' }) }

  font(doc, 8, 'bold'); doc.setTextColor(91, 195, 236)
  doc.text('REPORTE · SELAVA LAVANDERÍA Y DRY CLEAN', 62, 15, { charSpace: 0.4 })
  font(doc, 22, 'bold'); ink(doc, [255, 255, 255])
  doc.text(title, 62, 26)
  font(doc, 9.5); doc.setTextColor(201, 216, 224)
  doc.text(`Del ${dateLabel(start)} al ${dateLabel(end)}`, 62, 33.5)
  font(doc, 7.5); doc.setTextColor(169, 193, 205)
  doc.text(`Generado el ${generatedAt.format(new Date())}`, 62, 39.5)
}

function drawSummary(doc: JsPdf, summary: Summary[], y: number) {
  const width = doc.internal.pageSize.getWidth(), margin = 14, gap = 4
  const cardWidth = (width - margin * 2 - gap * (summary.length - 1)) / summary.length
  summary.forEach((item, index) => {
    const x = margin + index * (cardWidth + gap)
    const dark = index === 0
    fill(doc, dark ? NAVY : [255, 255, 255])
    stroke(doc, dark ? NAVY : LINE)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, cardWidth, 25, 3.5, 3.5, dark ? 'F' : 'FD')
    if (!dark) { fill(doc, item.accent ?? SKY); doc.roundedRect(x, y + 5, 1.6, 15, 0.8, 0.8, 'F') }
    font(doc, 6.8, 'bold'); doc.setTextColor(dark ? 169 : MUTED[0], dark ? 193 : MUTED[1], dark ? 205 : MUTED[2])
    doc.text(item.label.toUpperCase(), x + 5, y + 8, { charSpace: 0.3, maxWidth: cardWidth - 8 })
    font(doc, item.value.length > 14 ? 11 : 15, 'bold')
    if (dark) ink(doc, YELLOW); else ink(doc, INK)
    doc.text(item.value, x + 5, y + 19, { maxWidth: cardWidth - 8 })
  })
  return y + 25
}

function sectionTitle(doc: JsPdf, title: string, subtitle: string, y: number) {
  fill(doc, SKY)
  doc.roundedRect(14, y - 4, 3, 5.5, 1, 1, 'F')
  font(doc, 12.5, 'bold'); ink(doc, INK)
  doc.text(title, 20, y)
  if (subtitle) { font(doc, 8); ink(doc, MUTED); doc.text(subtitle, 20, y + 5) }
  return y + (subtitle ? 9 : 5)
}

function ensureSpace(doc: JsPdf, y: number, needed: number) {
  if (y + needed <= doc.internal.pageSize.getHeight() - 20) return y
  doc.addPage()
  return 20
}

function drawChart(doc: JsPdf, chart: Chart, y: number) {
  const width = doc.internal.pageSize.getWidth(), margin = 14
  const bars = chart.bars
  const height = chart.kind === 'columns' ? 64 : Math.max(26, bars.length * 9 + 12)
  y = ensureSpace(doc, y, height + 16)
  y = sectionTitle(doc, chart.title, chart.subtitle, y)
  fill(doc, [255, 255, 255]); stroke(doc, LINE); doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, width - margin * 2, height, 3.5, 3.5, 'FD')
  if (!bars.length || bars.every((bar) => bar.value <= 0)) {
    font(doc, 9); ink(doc, MUTED)
    doc.text('Sin datos para el período', width / 2, y + height / 2 + 1, { align: 'center' })
    return y + height + 10
  }
  const max = Math.max(...bars.map((bar) => bar.value))
  if (chart.kind === 'columns') {
    const left = margin + 8, right = width - margin - 6, top = y + 10, bottom = y + height - 11
    // Líneas guía.
    stroke(doc, [230, 238, 242]); doc.setLineWidth(0.2)
    for (let i = 0; i <= 3; i++) { const gy = bottom - (bottom - top) * i / 3; doc.line(left, gy, right, gy) }
    const slot = (right - left) / bars.length
    const barWidth = Math.min(16, slot * 0.62)
    const step = Math.max(1, Math.ceil(bars.length / 12))
    bars.forEach((bar, index) => {
      const cx = left + slot * index + slot / 2
      const h = bar.value > 0 ? Math.max(1.2, (bottom - top) * bar.value / max) : 0
      if (h > 0) {
        fill(doc, bar.value === max ? YELLOW : SKY)
        doc.roundedRect(cx - barWidth / 2, bottom - h, barWidth, h, 1.2, 1.2, 'F')
        if (bars.length <= 16) { font(doc, 6.5, 'bold'); ink(doc, INK); doc.text(bar.display, cx, bottom - h - 1.8, { align: 'center' }) }
      }
      if (index % step === 0 || index === bars.length - 1) { font(doc, 6.5); ink(doc, MUTED); doc.text(bar.label, cx, bottom + 5, { align: 'center' }) }
    })
  } else {
    const labelWidth = 46, left = margin + 6 + labelWidth, right = width - margin - 28
    bars.forEach((bar, index) => {
      const by = y + 8 + index * 9
      font(doc, 8.5, 'bold'); ink(doc, INK)
      doc.text(bar.label, margin + 6, by + 4, { maxWidth: labelWidth - 2 })
      fill(doc, PAPER); doc.roundedRect(left, by, right - left, 5.5, 2.7, 2.7, 'F')
      const w = (right - left) * bar.value / max
      if (w > 0) { fill(doc, bar.color ?? SKY); doc.roundedRect(left, by, Math.max(5.5, w), 5.5, 2.7, 2.7, 'F') }
      font(doc, 8, 'bold'); ink(doc, INK)
      doc.text(bar.display, width - margin - 6, by + 4, { align: 'right' })
    })
  }
  return y + height + 10
}

async function drawTable(doc: Doc, table: Table, y: number) {
  const { default: autoTable } = await import('jspdf-autotable')
  y = ensureSpace(doc, y, 30)
  y = sectionTitle(doc, table.title, '', y)
  const align = table.align ?? table.head.map((_, index) => index === 0 ? 'left' : 'right')
  autoTable(doc, {
    startY: y,
    head: [table.head],
    body: table.body.length ? table.body : [[{ content: 'Sin datos para el período', colSpan: table.head.length, styles: { halign: 'center', textColor: MUTED } }]],
    foot: table.foot && table.body.length ? [table.foot] : undefined,
    margin: { left: 14, right: 14, bottom: 20 },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 3.2, bottom: 3.2, left: 4, right: 4 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
    footStyles: { fillColor: YELLOW, textColor: INK, fontStyle: 'bold', lineWidth: 0 },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: Object.fromEntries(align.map((value, index) => [index, { halign: value }])),
    didParseCell: (data) => {
      // Encabezado y total alineados igual que su columna; la primera columna en negrita.
      if (data.section !== 'body') data.cell.styles.halign = align[data.column.index] ?? 'left'
      else if (data.column.index === 0) data.cell.styles.fontStyle = 'bold'
    },
    rowPageBreak: 'avoid',
  })
  return doc.lastAutoTable.finalY + 10
}

function drawFooters(doc: JsPdf, title: string) {
  const pages = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    stroke(doc, LINE); doc.setLineWidth(0.3)
    doc.line(14, height - 13, width - 14, height - 13)
    fill(doc, SKY); doc.circle(15.5, height - 8.2, 1.2, 'F')
    font(doc, 7.5, 'bold'); ink(doc, INK)
    doc.text('SELAVA', 18.5, height - 7.3)
    font(doc, 7.5); ink(doc, MUTED)
    doc.text(`Lavandería y Dry Clean · ${title}`, 31, height - 7.3)
    doc.text(`Página ${page} de ${pages}`, width - 14, height - 7.3, { align: 'right' })
  }
}

async function createReportPdf(title: string, start: string, end: string, summary: Summary[], charts: Chart[], tables: Table[], filename: string) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), loadLogo()])
  const doc = new jsPDF({ unit: 'mm', format: 'letter' }) as Doc
  doc.setProperties({ title: `${title} · SELAVA`, author: 'SELAVA', creator: 'SELAVA Administración' })
  fill(doc, [255, 255, 255])
  drawHeader(doc, title, start, end, logo)
  let y = drawSummary(doc, summary, 57) + 14
  for (const chart of charts) y = drawChart(doc, chart, y)
  for (const table of tables) y = await drawTable(doc, table, y)
  drawFooters(doc, title)
  doc.save(filename)
}

/** Agrupa por mes los períodos de más de dos meses y por día los cortos (igual que la gráfica del panel). */
function salesBars(report: ReporteVentas): { monthly: boolean; bars: Bar[] } {
  const start = parseDay(report.fecha_inicio), end = parseDay(report.fecha_fin)
  const monthly = Math.round((end.getTime() - start.getTime()) / 86400000) > 62
  const map = new Map<string, Bar>()
  if (monthly) {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      map.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { label: MONTHS[d.getMonth()], value: 0, display: '' })
    }
  }
  report.ventas_por_dia.forEach((day) => {
    const key = monthly ? day.fecha.slice(0, 7) : day.fecha.slice(0, 10)
    const d = parseDay(day.fecha)
    const bar = map.get(key) ?? { label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, value: 0, display: '' }
    bar.value += day.total_ventas
    map.set(key, bar)
  })
  const bars = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, bar]) => ({ ...bar, display: bar.value ? `Q${number.format(Math.round(bar.value))}` : '' }))
  return { monthly, bars }
}

export function exportSalesReportPdf(report: ReporteVentas) {
  const average = report.cantidad_ventas > 0 ? report.total_ventas / report.cantidad_ventas : 0
  const { monthly, bars } = salesBars(report)
  return createReportPdf('Reporte de ventas', report.fecha_inicio, report.fecha_fin, [
    { label: 'Total vendido', value: currency.format(report.total_ventas) },
    { label: 'Ventas', value: String(report.cantidad_ventas), accent: SKY },
    { label: 'Pagos recibidos', value: String(report.cantidad_pagos), accent: GREEN },
    { label: 'Promedio por venta', value: currency.format(average), accent: YELLOW },
  ], [
    { title: monthly ? 'Ventas por mes' : 'Ventas por día', subtitle: 'Monto recibido en el período · el mejor resaltado en amarillo', kind: 'columns', bars },
    { title: 'Métodos de pago', subtitle: 'Distribución de los ingresos', kind: 'rows', bars: report.ventas_por_metodo_pago.filter((item) => item.total_ventas > 0).map((item, index) => ({ label: item.metodo_pago.nombre, value: item.total_ventas, display: `${currency.format(item.total_ventas)} · ${report.total_ventas ? Math.round(item.total_ventas / report.total_ventas * 100) : 0}%`, color: [SKY, YELLOW, GREEN, [201, 184, 255] as Rgb][index % 4] })) },
  ], [
    { title: 'Detalle por día', head: ['Fecha', 'Ventas', 'Pagos', 'Total'], body: report.ventas_por_dia.filter((item) => item.total_ventas > 0).map((item) => [dateLabel(item.fecha), item.cantidad_ventas, item.cantidad_pagos, currency.format(item.total_ventas)]), foot: ['Total del período', report.cantidad_ventas, report.cantidad_pagos, currency.format(report.total_ventas)] },
    { title: 'Detalle por método de pago', head: ['Método', 'Ventas', 'Pagos', 'Total'], body: report.ventas_por_metodo_pago.map((item) => [item.metodo_pago.nombre, item.cantidad_ventas, item.cantidad_pagos, currency.format(item.total_ventas)]) },
  ], `selava-ventas-${report.fecha_inicio}-${report.fecha_fin}.pdf`)
}

const stateColor = (name: string, index: number): Rgb => {
  const n = name.toLowerCase()
  if (n.includes('recib')) return [245, 163, 58]
  if (n.includes('seco')) return [62, 88, 102]
  if (n.includes('lavad')) return [123, 92, 224]
  if (n.includes('planch')) return [255, 201, 60]
  if (n.includes('rack')) return [14, 155, 214]
  if (n.includes('final') || n.includes('entreg')) return [31, 138, 91]
  if (n.includes('cancel')) return [200, 64, 31]
  return STATE_COLORS[index % STATE_COLORS.length]
}

export function exportOrdersByStatusReportPdf(report: ReportePedidosPorEstado) {
  const states = report.pedidos_por_estado.slice().sort((a, b) => (a.estado.orden ?? 0) - (b.estado.orden ?? 0))
  const active = states.filter((item) => item.cantidad_pedidos > 0)
  const leading = active.reduce<(typeof active)[number] | null>((current, item) => !current || item.cantidad_pedidos > current.cantidad_pedidos ? item : current, null)
  const pct = (n: number) => report.total_pedidos > 0 ? `${number.format(n / report.total_pedidos * 100)}%` : '0%'
  return createReportPdf('Pedidos por estado', report.fecha_inicio, report.fecha_fin, [
    { label: 'Pedidos activos', value: String(report.total_pedidos) },
    { label: 'Estados con pedidos', value: `${active.length} de ${states.length}`, accent: [123, 92, 224] },
    { label: 'Estado predominante', value: leading ? `${leading.estado.nombre} · ${pct(leading.cantidad_pedidos)}` : 'Sin pedidos', accent: YELLOW },
  ], [
    { title: 'Distribución de pedidos', subtitle: 'Cantidad de pedidos en cada etapa del proceso', kind: 'rows', bars: states.map((item, index) => ({ label: item.estado.nombre, value: item.cantidad_pedidos, display: `${item.cantidad_pedidos} · ${pct(item.cantidad_pedidos)}`, color: stateColor(item.estado.nombre, index) })) },
  ], [
    { title: 'Detalle por estado', head: ['Estado', 'Pedidos', 'Porcentaje'], body: states.map((item) => [item.estado.nombre, item.cantidad_pedidos, pct(item.cantidad_pedidos)]), foot: ['Total', report.total_pedidos, report.total_pedidos ? '100%' : '0%'] },
  ], `selava-pedidos-estado-${report.fecha_inicio}-${report.fecha_fin}.pdf`)
}

export function exportSupplyConsumptionReportPdf(report: ReporteConsumoInsumos) {
  const consumed = report.consumo_por_insumo.filter((item) => item.cantidad_consumida > 0).sort((a, b) => b.cantidad_consumida - a.cantidad_consumida)
  const leading = consumed[0]
  return createReportPdf('Consumo de insumos', report.fecha_inicio, report.fecha_fin, [
    { label: 'Insumos consumidos', value: String(consumed.length) },
    { label: 'Movimientos de salida', value: String(report.cantidad_movimientos), accent: GREEN },
    { label: 'Mayor consumo', value: leading ? `${leading.nombre} · ${number.format(leading.cantidad_consumida)} ${leading.unidad_medida}` : 'Sin consumo', accent: [181, 84, 26] },
  ], [
    { title: 'Consumo por insumo', subtitle: 'Cantidad total utilizada durante el período', kind: 'rows', bars: consumed.map((item) => ({ label: item.nombre, value: item.cantidad_consumida, display: `${number.format(item.cantidad_consumida)} ${item.unidad_medida}` })) },
  ], [
    { title: 'Detalle de consumo', head: ['Insumo', 'Unidad', 'Movimientos', 'Cantidad consumida'], body: consumed.map((item) => [item.nombre, item.unidad_medida, item.cantidad_movimientos, number.format(item.cantidad_consumida)]), align: ['left', 'left', 'right', 'right'] },
  ], `selava-consumo-insumos-${report.fecha_inicio}-${report.fecha_fin}.pdf`)
}
