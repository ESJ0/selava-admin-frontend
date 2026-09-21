import { api } from './client'
import type { MetodoPago, PagoCreatePayload, PagoDetalle, SaldoPedido } from '../types'

export async function getOrderBalance(orderId: number, signal?: AbortSignal) {
  return (await api.get<SaldoPedido>(`/pedidos/${orderId}/saldo`, { signal })).data
}

export async function getOrderPayments(orderId: number, signal?: AbortSignal) {
  return (await api.get<PagoDetalle[]>(`/pedidos/${orderId}/pagos`, { signal })).data
}

export async function listPaymentMethods(signal?: AbortSignal) {
  return (await api.get<MetodoPago[]>('/metodos-pago/', { signal })).data
}

export async function registerOrderPayment(orderId: number, payload: PagoCreatePayload) {
  return (await api.post<PagoDetalle>(`/pedidos/${orderId}/pagos`, payload)).data
}
