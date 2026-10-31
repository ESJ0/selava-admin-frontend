import type { EstadoPedido, ModalidadCobro, PedidoResumen } from '../types'
import { paymentIconPath, stageIconPath } from './adminPaths'

const amount = new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortDate = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'America/Guatemala' })
const dateTime = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Guatemala' })
const measureFormat = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 3 })

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Importe con el formato del diseño: "Q 1,234.50". */
export const money = (value: number) => `Q ${amount.format(value)}`
/** Variante sin centavos cuando son cero ("Q 300"). */
export const moneyShort = (value: number) => money(value).replace(/\.00$/, '')
export const orderCode = (id: number) => `#SLV-${String(id).padStart(4, '0')}`
export const formatShortDate = (value?: string) => (value ? shortDate.format(new Date(value)) : '')
export const formatDateTime = (value: string) => dateTime.format(new Date(value))
export const formatMeasure = (value: number) => measureFormat.format(value)

export function longDate(date: Date) {
  return `${capitalize(WEEKDAYS[date.getDay()])} ${date.getDate()} de ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`
}

export function todayText() {
  return longDate(new Date())
}

export function startOfDay(date = new Date()) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** Fecha calendario (en Guatemala) de un ISO del backend, a medianoche local. */
export function calendarDay(value?: string): Date | null {
  if (!value) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

const palette: [string, string][] = [['#0A2433', '#FFC93C'], ['#0E9BD6', '#0A2433'], ['#FFC93C', '#0A2433'], ['#DDF1FA', '#06709F'], ['#E2F6EC', '#1F8A5B']]
/** Colores de avatar estables según las iniciales. */
export function avatarColors(text: string): [string, string] {
  return palette[((text.charCodeAt(0) || 0) + (text.charCodeAt(1) || 0)) % palette.length]
}

export const formatPhone = (phone: string) => (/^\d{8}$/.test(phone) ? `${phone.slice(0, 4)}-${phone.slice(4)}` : phone)

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

export function stageKey(status: Pick<EstadoPedido, 'nombre' | 'codigo'>) {
  return normalize(status.codigo || status.nombre).replace(/[^A-Z0-9]+/g, '_')
}

export function isCancelled(status: EstadoPedido) {
  return status.es_cancelacion === true || stageKey(status).includes('CANCEL')
}

export function isClosed(status: EstadoPedido) {
  const key = stageKey(status)
  return isCancelled(status) || status.es_terminal === true || key.includes('FINALIZ') || key.includes('ENTREGAD')
}

export function isActiveOrder(order: Pick<PedidoResumen, 'estado_actual' | 'activo'>) {
  return order.activo !== false && !isClosed(order.estado_actual)
}

/** Colores de chip por etapa (fondo, punto), según el diseño. */
export function stageLook(status: Pick<EstadoPedido, 'nombre' | 'codigo'> & Partial<EstadoPedido>): [string, string] {
  const key = stageKey(status)
  if (key.includes('CANCEL') || status.es_cancelacion) return ['#FDEDE6', '#C8401F']
  if (key.includes('RECIB')) return ['#DDF1FA', '#0E9BD6']
  if (key.includes('PLANCH')) return ['#FFF4D6', '#E0A100']
  if (key.includes('SECAD')) return ['#EAF4FF', '#5B8DEF']
  if (key.includes('LAVAD')) return ['#E3EEFF', '#3D6FD9']
  if (key.includes('RACK') || key.includes('LISTO')) return ['#FFE7B0', '#B87A00']
  if (key.includes('FINAL') || key.includes('ENTREG') || status.es_terminal) return ['#E2F6EC', '#1F8A5B']
  return ['#EEF3F6', '#5A7280']
}

export function stageIcon(status: Pick<EstadoPedido, 'nombre' | 'codigo'>) {
  const key = stageKey(status)
  if (key.includes('RECIB')) return stageIconPath.received
  if (key.includes('SECAD')) return stageIconPath.drying
  if (key.includes('PLANCH')) return stageIconPath.ironing
  if (key.includes('LAVAD')) return stageIconPath.washing
  if (key.includes('RACK') || key.includes('LISTO')) return stageIconPath.rack
  if (key.includes('FINAL') || key.includes('ENTREG')) return stageIconPath.done
  return stageIconPath.generic
}

export function paymentIcon(name: string) {
  const key = normalize(name)
  if (key.includes('TARJ') || key.includes('CARD') || key.includes('POS')) return paymentIconPath.card
  if (key.includes('TRANSF') || key.includes('DEPOS') || key.includes('BANC')) return paymentIconPath.transfer
  return paymentIconPath.cash
}

export const unitShort = (mode: ModalidadCobro) => (mode === 'LIBRA' ? 'lb' : mode === 'METRO' ? 'm' : 'u')
export const unitName = (mode: ModalidadCobro, value: number) => mode === 'LIBRA' ? (value === 1 ? 'libra' : 'libras') : mode === 'METRO' ? (value === 1 ? 'metro' : 'metros') : (value === 1 ? 'unidad' : 'unidades')
export const unitPer = (mode: ModalidadCobro) => `por ${unitName(mode, 1)}`

export function garmentIconPath(name: string, mode: ModalidadCobro) {
  const key = normalize(name)
  if (key.includes('PANTAL') || key.includes('JEAN')) return 'M7 3h10l1 18h-4.5L12 10l-1.5 11H6zM7 7h10'
  if (mode === 'LIBRA' || key.includes('CANAST')) return 'M3 10h18l-2 10H5zM7 10l3-6M17 10l-3-6M9 14v3M12 14v3M15 14v3'
  if (mode === 'METRO' || key.includes('ALFOMB') || key.includes('CORTIN')) return 'M4 6h12a4 4 0 0 1 0 8H4zM16 10H4M4 14v4h12'
  return 'M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z'
}

const swatches: Record<string, string> = {
  BLANCO: '#FFFFFF', NEGRO: '#1B1B1B', AZUL: '#2F5DA8', GRIS: '#9AA5AD', BEIGE: '#D9C3A0', ROJO: '#C0392B', VERDE: '#2F855A',
  AMARILLO: '#FFC93C', CAFE: '#8B5E3C', ROSADO: '#F2A7C3', ROSA: '#F2A7C3', MORADO: '#7B5EA7', CELESTE: '#5BC3EC', NARANJA: '#E07A1F',
}
export const colorSwatch = (color: string) => swatches[normalize(color).split(/\s+/)[0]] ?? '#DCE7EC'

export function roleLabel(roleId: number | null) {
  return roleId === 3 ? 'Operario' : roleId === 2 ? 'Recepcionista' : 'Administrador'
}

/** Ícono decorativo de un servicio según su nombre. */
export function serviceIconPath(name: string) {
  const key = normalize(name)
  if (key.includes('PLANCH')) return 'M3 18h18c0-5-3-8-8-8H8c0 4-2 6-5 8zM9 10V7h9'
  if (key.includes('SECO') || key.includes('SECAD')) return 'M4 4h16v16H4zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z'
  return 'M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0'
}
