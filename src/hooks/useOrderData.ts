import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrder, getOrderHistory, listOrderStatuses } from '../api/orders'
import { errorMessage, httpStatus } from '../api/client'
import type { EstadoPedido, HistorialEstado, PedidoDetalle } from '../types'

export function useOrderData(orderId: number) {
  const [order, setOrder] = useState<PedidoDetalle | null>(null)
  const [history, setHistory] = useState<HistorialEstado[]>([])
  const [statuses, setStatuses] = useState<EstadoPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const request = useRef<AbortController | null>(null)

  const fetchData = useCallback(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    return Promise.all([
        getOrder(orderId, controller.signal), getOrderHistory(orderId, controller.signal), listOrderStatuses(controller.signal),
      ]).then(([detail, timeline, catalog]) => {
      if (controller.signal.aborted) return false
      setOrder(detail); setHistory(timeline ?? []); setStatuses(catalog ?? []); setNotFound(!detail)
      return Boolean(detail)
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return false
      // No mantener acciones basadas en un detalle obsoleto si falla la recarga.
      setOrder(null); setHistory([]); setStatuses([])
      setError(errorMessage(cause)); setNotFound(httpStatus(cause) === 404)
      return false
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
  }, [orderId])

  const load = useCallback(() => {
    setLoading(true); setError(''); setNotFound(false)
    return fetchData()
  }, [fetchData])

  useEffect(() => {
    void fetchData()
    return () => request.current?.abort()
  }, [fetchData])

  const isActive = () => request.current !== null && !request.current.signal.aborted
  return { order, history, statuses, loading, error, setError, notFound, load, isActive }
}
