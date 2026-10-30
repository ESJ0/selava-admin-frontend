import type { jsPDF as JsPdf } from 'jspdf'
import type { ReporteConsumoInsumos, ReportePedidosPorEstado, ReporteVentas } from '../types'

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const number = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })
const generatedAt = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' })

type Summary = { label: string; value: string }
type Table = { title: string; head: string[]; body: Array<Array<string | number>> }

function dateLabel(value: string) {
  return date.format(new Date(`${value}T12:00:00`))
}

async function createReportPdf(title: string, start: string, end: string, summary: Summary[], tables: Table[], filename: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const width = doc.internal.pageSize.getWidth()
  const margin = 15

  doc.setFillColor(5, 43, 70)
  doc.rect(0, 0, width, 31, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('SeLava', margin, 13)
  doc.setFontSize(13)
  doc.text(title, margin, 23)

  doc.setTextColor(44, 62, 80)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Período consultado: ${dateLabel(start)} al ${dateLabel(end)}`, margin, 39)
  doc.text(`Generado: ${generatedAt.format(new Date())}`, margin, 44)

  const columnWidth = (width - margin * 2 - 4 * (summary.length - 1)) / summary.length
  summary.forEach((item, index) => {
    const x = margin + index * (columnWidth + 4)
    doc.setFillColor(239, 248, 252)
    doc.roundedRect(x, 50, columnWidth, 19, 2, 2, 'F')
    doc.setTextColor(95, 117, 143)
    doc.setFontSize(7.5)
    doc.text(item.label, x + 3, 56)
    doc.setTextColor(5, 43, 70)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(item.value, x + 3, 64, { maxWidth: columnWidth - 6 })
    doc.setFont('helvetica', 'normal')
  })

  let y = 77
  for (const table of tables) {
    doc.setTextColor(5, 43, 70)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(table.title, margin, y)
    autoTable(doc, {
      startY: y + 3,
      head: [table.head],
      body: table.body.length > 0 ? table.body : [['Sin datos para el período']],
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [44, 62, 80] },
      headStyles: { fillColor: [0, 142, 199], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 250, 252] },
      didDrawPage: ({ pageNumber }) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(120, 135, 151)
        doc.text(`SeLava · ${title}`, margin, doc.internal.pageSize.getHeight() - 7)
        doc.text(`Página ${pageNumber}`, width - margin, doc.internal.pageSize.getHeight() - 7, { align: 'right' })
      },
    })
    y = (doc as JsPdf & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  doc.save(filename)
}

export function exportSalesReportPdf(report: ReporteVentas) {
  const average = report.cantidad_ventas > 0 ? report.total_ventas / report.cantidad_ventas : 0
  createReportPdf('Reporte de ventas', report.fecha_inicio, report.fecha_fin, [
    { label: 'TOTAL VENDIDO', value: currency.format(report.total_ventas) },
    { label: 'VENTAS', value: String(report.cantidad_ventas) },
    { label: 'PAGOS', value: String(report.cantidad_pagos) },
    { label: 'PROMEDIO', value: currency.format(average) },
  ], [
    { title: 'Ventas por día', head: ['Fecha', 'Ventas', 'Pagos', 'Total'], body: report.ventas_por_dia.map((item) => [dateLabel(item.fecha), item.cantidad_ventas, item.cantidad_pagos, currency.format(item.total_ventas)]) },
    { title: 'Ventas por método de pago', head: ['Método', 'Ventas', 'Pagos', 'Total'], body: report.ventas_por_metodo_pago.map((item) => [item.metodo_pago.nombre, item.cantidad_ventas, item.cantidad_pagos, currency.format(item.total_ventas)]) },
  ], `selava-ventas-${report.fecha_inicio}-${report.fecha_fin}.pdf`)
}

export function exportOrdersByStatusReportPdf(report: ReportePedidosPorEstado) {
  const active = report.pedidos_por_estado.filter((item) => item.cantidad_pedidos > 0)
  const leading = active.reduce<(typeof active)[number] | null>((current, item) => !current || item.cantidad_pedidos > current.cantidad_pedidos ? item : current, null)
  createReportPdf('Pedidos por estado', report.fecha_inicio, report.fecha_fin, [
    { label: 'PEDIDOS', value: String(report.total_pedidos) },
    { label: 'ESTADOS CON PEDIDOS', value: String(active.length) },
    { label: 'ESTADO PREDOMINANTE', value: leading?.estado.nombre ?? 'Sin pedidos' },
  ], [{
    title: 'Distribución de pedidos',
    head: ['Estado', 'Cantidad', 'Porcentaje'],
    body: report.pedidos_por_estado.map((item) => [item.estado.nombre, item.cantidad_pedidos, `${report.total_pedidos > 0 ? number.format(item.cantidad_pedidos / report.total_pedidos * 100) : '0'}%`]),
  }], `selava-pedidos-estado-${report.fecha_inicio}-${report.fecha_fin}.pdf`)
}

export function exportSupplyConsumptionReportPdf(report: ReporteConsumoInsumos) {
  const consumed = report.consumo_por_insumo.filter((item) => item.cantidad_consumida > 0)
  const leading = consumed.reduce<(typeof consumed)[number] | null>((current, item) => !current || item.cantidad_consumida > current.cantidad_consumida ? item : current, null)
  createReportPdf('Consumo de insumos', report.fecha_inicio, report.fecha_fin, [
    { label: 'INSUMOS CONSUMIDOS', value: String(consumed.length) },
    { label: 'MOVIMIENTOS', value: String(report.cantidad_movimientos) },
    { label: 'MAYOR CONSUMO', value: leading ? `${number.format(leading.cantidad_consumida)} ${leading.unidad_medida}` : 'Sin consumo' },
  ], [{
    title: 'Detalle de consumo',
    head: ['Insumo', 'Unidad', 'Movimientos', 'Cantidad consumida'],
    body: consumed.map((item) => [item.nombre, item.unidad_medida, item.cantidad_movimientos, number.format(item.cantidad_consumida)]),
  }], `selava-consumo-insumos-${report.fecha_inicio}-${report.fecha_fin}.pdf`)
}
