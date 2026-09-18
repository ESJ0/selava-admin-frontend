import { api } from './client'
import type { MetodoPago, PagoDetalle, SaldoPedido } from '../types'

export async function getOrderBalance(orderId: number, signal?: AbortSignal) {
  return (await api.get<SaldoPedido>(`/pedidos/${orderId}/saldo`, { signal })).data
}

export async function listActivePaymentMethods(signal?: AbortSignal) {
  const methods = (await api.get<MetodoPago[]>('/metodos-pago/', { signal })).data
  return methods.filter(method => method.activo)
}

export async function registerPayment(orderId: number, methodId: number, amount: number, reference?: string) {
  return (await api.post<PagoDetalle>(`/pedidos/${orderId}/pagos`, {
    metodo_pago_id: methodId,
    monto: amount,
    ...(reference?.trim() && { referencia: reference.trim() }),
  })).data
}
