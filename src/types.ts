export interface Entity { id: number; nombre: string; activo: boolean }
export interface Servicio extends Entity { descripcion?: string; precio_base: number; tiempo_estimado_horas?: number }
export interface TipoPrenda extends Entity { descripcion?: string }
export interface MetodoPago extends Entity {}
export interface Cliente extends Entity { apellido: string; telefono: string; email?: string }
export interface Pedido { id: number; cliente_id: number }
export interface PrendaDraft { tipo_prenda_id: number | ''; cantidad: number; color: string; descripcion: string; servicio_ids: number[] }
export type CatalogKind = 'servicios' | 'tipos-prenda' | 'metodos-pago'
