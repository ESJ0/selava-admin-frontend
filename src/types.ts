export interface Entity { id: number; nombre: string; activo: boolean }
export interface Servicio extends Entity { descripcion?: string; precio_base: number; tiempo_estimado_horas?: number }
export interface TipoPrenda extends Entity { descripcion?: string }
export interface MetodoPago extends Entity {}
export interface Cliente extends Entity { apellido: string; telefono: string; email?: string; direccion?: string }
export interface PrendaServicioCreada { id: number; prenda_id: number; servicio_id: number; precio_aplicado: number; servicio?: Servicio }
export interface PrendaCreada { id: number; pedido_id: number; tipo_prenda_id: number; cantidad: number; color?: string; descripcion?: string; servicios: PrendaServicioCreada[] }
export interface Pedido { id: number; cliente_id: number; estado_actual_id: number; total: number; prendas: PrendaCreada[] }
export interface PrendaDetalleDraft { cantidad: number; color: string; descripcion: string; servicio_ids: number[] }
export interface PrendaDraft {
  tipo_prenda_id: number | ''
  cantidad: number | ''
  aplicar_servicio_comun: boolean
  servicio_ids_comunes: number[]
  detalles: PrendaDetalleDraft[]
}
export type CatalogKind = 'servicios' | 'tipos-prenda' | 'metodos-pago'

export interface EstadoPedido {
  id: number
  nombre: string
  orden: number
  created_at?: string
  updated_at?: string
}

export interface PrendaServicioDetalle {
  id: number
  prenda_id: number
  servicio_id: number
  precio_aplicado: number
  servicio?: Servicio
}

export interface PrendaDetalle extends PrendaCreada {
  tipo_prenda?: TipoPrenda
  servicios: PrendaServicioDetalle[]
}

export interface PagoDetalle {
  id: number
  pedido_id: number
  metodo_pago_id: number
  usuario_id: number
  monto: number
  referencia?: string
  fecha_pago: string
  metodo_pago: MetodoPago
  usuario?: PagoUsuario
}

export interface PagoUsuario {
  id: number
  nombre: string
  apellido: string
}

export interface SaldoPedido {
  pedido_id: number
  total: number
  total_pagado: number
  saldo_pendiente: number
}

export interface PagoCreatePayload {
  metodo_pago_id: number
  monto: number
  referencia?: string
}

export interface Insumo {
  id: number
  nombre: string
  descripcion?: string
  unidad_medida: string
  stock_actual: number
  stock_minimo: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface InsumoCreatePayload {
  nombre: string
  descripcion?: string
  unidad_medida: string
  stock_actual: number
  stock_minimo: number
}

export type InsumoUpdatePayload = Partial<InsumoCreatePayload & Pick<Insumo, 'activo'>>

export type TipoMovimientoInventario = 'entrada' | 'salida'

export interface MovimientoInventario {
  id: number
  insumo_id: number
  usuario_id: number
  tipo_movimiento: TipoMovimientoInventario
  cantidad: number
  motivo?: string
  fecha_movimiento: string
  created_at: string
}

export interface MovimientoInventarioCreatePayload {
  insumo_id: number
  tipo_movimiento: TipoMovimientoInventario
  cantidad: number
  motivo?: string
}

export interface PedidoDetalle {
  id: number
  cliente_id: number
  usuario_id: number
  estado_actual_id: number
  fecha_recibido: string
  fecha_entrega_estimada?: string
  fecha_entrega_real?: string
  total: number
  observaciones?: string
  activo: boolean
  cliente: Cliente
  prendas: PrendaDetalle[]
  estado_actual: EstadoPedido
  pagos: PagoDetalle[]
}

export interface HistorialEstado {
  id: number
  pedido_id: number
  estado_id: number
  usuario_id: number
  fecha_cambio: string
  observaciones?: string
  estado: EstadoPedido
  usuario: { id: number; nombre: string; apellido: string }
}
