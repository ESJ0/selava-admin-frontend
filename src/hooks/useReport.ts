import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'

export type PresetKey = 'm' | '30' | '90' | 'y'
export const PRESETS: [PresetKey, string][] = [['m', 'Este mes'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['y', 'Este año']]
export interface Period { from: string; to: string; preset: PresetKey | '' }

export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function presetPeriod(key: PresetKey, today = new Date()): Period {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (key === 'm') start.setDate(1)
  else if (key === 'y') start.setMonth(0, 1)
  else start.setDate(start.getDate() - Number(key))
  return { from: isoDate(start), to: isoDate(today), preset: key }
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const parts = (value: string) => value.slice(0, 10).split('-').map(Number)
export const longDay = (value: string) => { const [y, m, d] = parts(value); return `${d} de ${MONTHS[m - 1]} de ${y}` }
/** "21-oct" como en el eje de la gráfica del diseño. */
export const dashDay = (value: string) => { const [, m, d] = parts(value); return `${d}-${MONTHS_SHORT[m - 1]}` }
export const spaceDay = (value: string) => { const [, m, d] = parts(value); return `${d} ${MONTHS_SHORT[m - 1]}` }
export const weekdayDay = (value: string) => { const [y, m, d] = parts(value); return `${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(y, m - 1, d).getDay()]} ${d}-${MONTHS_SHORT[m - 1]}` }
export const qMoney = (value: number) => `Q ${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const qty = (value: number) => String(Math.round(value * 100) / 100)

/** Período con atajos y carga automática del reporte (con una pequeña espera al escribir fechas). */
export function useReport<T>(fetcher: (from: string, to: string, signal?: AbortSignal) => Promise<T>) {
  const [period, setPeriod] = useState<Period>(() => presetPeriod('m'))
  const [report, setReport] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const badRange = !period.from || !period.to || period.from > period.to

  useEffect(() => {
    if (badRange) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      fetcher(period.from, period.to, controller.signal)
        .then((response) => { if (!controller.signal.aborted) setReport(response) })
        .catch((cause) => { if (!controller.signal.aborted) { setReport(null); setError(errorMessage(cause)) } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, period.preset ? 0 : 450)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [fetcher, period, badRange, attempt])

  return {
    period, report, loading, error, badRange,
    pick: (key: PresetKey) => setPeriod(presetPeriod(key)),
    setFrom: (from: string) => setPeriod((current) => ({ ...current, from, preset: '' })),
    setTo: (to: string) => setPeriod((current) => ({ ...current, to, preset: '' })),
    retry: () => setAttempt((n) => n + 1),
  }
}

const motionOk = () => typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Progreso 0→1 (easing cúbico) para los contadores animados del diseño; se reinicia con cada clave nueva. */
export function useCountUp(key: unknown) {
  const [state, setState] = useState<{ key: unknown; t: number }>({ key, t: 1 })
  useEffect(() => {
    if (!motionOk()) return
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start - 250) / 1100))
      setState({ key, t })
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [key])
  const t = state.key === key ? state.t : (motionOk() ? 0 : 1)
  return 1 - Math.pow(1 - t, 3)
}
