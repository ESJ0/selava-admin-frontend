import { create } from 'zustand'
import { errorMessage } from '../api/client'
import { listOrders } from '../api/orders'
import type { PedidoResumen } from '../types'

const PAGE_SIZE = 100
const MAX_PAGES = 20
const STALE_MS = 60_000

interface OrdersOverviewState {
  orders: PedidoResumen[]
  total: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
  loadedAt: number
  load: (force?: boolean) => Promise<void>
}

let inFlight: Promise<void> | null = null

/** Resumen de todos los pedidos (paginado en el servidor) para el inicio y las alertas. */
export const useOrdersOverview = create<OrdersOverviewState>((set, get) => ({
  orders: [], total: 0, status: 'idle', error: '', loadedAt: 0,
  load: (force = false) => {
    const state = get()
    if (inFlight) return inFlight
    if (!force && state.status === 'ready' && Date.now() - state.loadedAt < STALE_MS) return Promise.resolve()
    set({ status: state.status === 'ready' ? 'ready' : 'loading', error: '' })
    inFlight = (async () => {
      try {
        const orders: PedidoResumen[] = []
        let total = 0
        for (let page = 1; page <= MAX_PAGES; page++) {
          const response = await listOrders({ pagina: page, limite: PAGE_SIZE, orden: 'recientes' })
          total = response?.total ?? 0
          orders.push(...(response?.pedidos ?? []))
          if (!response?.pedidos?.length || orders.length >= total) break
        }
        set({ orders, total, status: 'ready', error: '', loadedAt: Date.now() })
      } catch (cause) {
        set({ status: 'error', error: errorMessage(cause) })
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  },
}))
