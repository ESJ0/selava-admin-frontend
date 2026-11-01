import type { ModalidadCobro } from '../types'

/** Modalidades de cobro tal como las presenta el diseño. */
export const MODES: Record<ModalidadCobro, { label: string; per: string; ex: string; icon: string; short: string; qtyLabel: string }> = {
  UNIDAD: { label: 'Por unidad', per: 'por unidad', ex: 'camisa, vestido', icon: 'M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z', short: 'u', qtyLabel: 'Cantidad requerida' },
  LIBRA: { label: 'Por libra', per: 'por libra', ex: 'canasta', icon: 'M3 10h18l-2 10H5zM7 10l3-6M17 10l-3-6M9 14v3M12 14v3M15 14v3', short: 'lb', qtyLabel: 'Libras requeridas' },
  METRO: { label: 'Por metro', per: 'por metro', ex: 'alfombra', icon: 'M4 6h12a4 4 0 0 1 0 8H4zM16 10H4M4 14v4h12', short: 'm', qtyLabel: 'Metros requeridos' },
}
export const MODE_KEYS: ModalidadCobro[] = ['UNIDAD', 'LIBRA', 'METRO']

export function modeOf(value: string | undefined | null): ModalidadCobro {
  return value === 'LIBRA' || value === 'METRO' ? value : 'UNIDAD'
}

export function garmentIcon(name: string, mode: ModalidadCobro) {
  if (/pantal/i.test(name)) return 'M7 3h10l1 18h-4.5L12 10l-1.5 11H6zM7 7h10'
  if (/vestido/i.test(name)) return 'M9 3h6l-1 4 5 14H5l5-14z'
  return MODES[mode].icon
}

export function serviceIcon(name: string) {
  if (/seco/i.test(name)) return 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM9 14h6'
  if (/planch/i.test(name)) return 'M3 18h18c0-5-3-8-8-8H8c0 4-2 6-5 8zM9 10V7h9'
  if (/lav/i.test(name)) return 'M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0'
  return 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z'
}

export function serviceEta(hours: number | undefined) {
  if (!hours) return 'Sin tiempo estimado'
  if (hours < 24) return 'Listo el mismo día'
  if (hours === 24) return 'Listo en 1 día'
  return `Listo en ${Math.round(hours / 24 * 10) / 10} días`
}

export const clockPct = (hours: number | undefined) => Math.min(100, Math.round((hours ?? 0) / 48 * 100))

export function paymentLook(name: string) {
  if (/efectiv|cash/i.test(name)) return { icon: 'M2.5 6h19v12h-19zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM6 9.5v5M18 9.5v5', bg: '#1F8A5B', fg: '#fff', kind: 'EFECTIVO' }
  if (/tarjet|card|crédit|credit|débit|debit|pos/i.test(name)) return { icon: 'M3 6h18v13H3zM3 10h18M7 15h4', bg: '#0A2433', fg: '#fff', kind: 'TARJETA' }
  if (/transfer|banco|dep[oó]sit/i.test(name)) return { icon: 'M4 10h16L12 4zM6 10v8M10 10v8M14 10v8M18 10v8M3 20h18', bg: '#0E9BD6', fg: '#0A2433', kind: 'BANCARIO' }
  if (/m[oó]vil|qr|app|billetera|wallet/i.test(name)) return { icon: 'M7 2h10v20H7zM11 18h2', bg: '#FFC93C', fg: '#0A2433', kind: 'DIGITAL' }
  return { icon: 'M3 7h15a3 3 0 0 1 3 3v8H3zM3 7l12-4v4M16 13h2', bg: '#3E5866', fg: '#fff', kind: 'OTRO' }
}

/** Estado de existencias: [etiqueta, fondo, texto, color del nivel]. */
export function stockState(stock: number, min: number, active: boolean, low = false): [string, string, string, string] {
  if (!active) return ['Inactivo', '#EEF3F6', '#5A7280', '#C9D8DF']
  if (stock <= 0) return ['Agotado', '#FDEDE6', '#C8401F', '#F08A63']
  if (low || stock <= min) return ['Stock bajo', '#FFF4D6', '#9A6A00', '#FFC93C']
  return ['Disponible', '#E2F6EC', '#1F8A5B', '#5BC3EC']
}
export const tankCap = (stock: number, min: number) => Math.max(min * 4, stock * 1.25, 1)
export const fmtN = (value: number) => (Math.round(value * 100) / 100).toString()

/** Convierte texto con coma o punto en número; NaN si está vacío. */
export const parseNum = (value: string) => value.trim() === '' ? Number.NaN : Number(value.replace(',', '.'))
export const onlyDecimal = (value: string) => value.replace(/[^0-9.,]/g, '')

/** Filtro común de pestañas Todos/Activos/Inactivos y búsqueda por texto. */
export function filterByTab<T extends { activo: boolean }>(items: T[], tab: number, query: string, text: (item: T) => string) {
  const q = query.trim().toLowerCase()
  return items.filter((item) => tab === 0 || (tab === 1 ? item.activo : !item.activo)).filter((item) => !q || text(item).toLowerCase().includes(q))
}

export const cardDelay = (index: number, step = 0.05) => `${(0.25 + Math.min(index, 16) * step).toFixed(2)}s`
