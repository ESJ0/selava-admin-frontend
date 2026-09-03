export interface Entity { id: number; nombre: string; activo: boolean }
export interface Servicio extends Entity { descripcion?: string; precio_base: number; tiempo_estimado_horas?: number }
export interface TipoPrenda extends Entity { descripcion?: string }
export interface MetodoPago extends Entity {}
export interface Cliente extends Entity { apellido: string; telefono: string; email?: string }
export interface PrendaServicioCreada { id: number; prenda_id: number; servicio_id: number; precio_aplicado: number; servicio?: Servicio }
export interface PrendaCreada { id: number; pedido_id: number; tipo_prenda_id: number; cantidad: number; color?: string; descripcion?: string; servicios: PrendaServicioCreada[] }
export interface Pedido { id: number; cliente_id: number; total?: number; prendas: PrendaCreada[] }
export interface PrendaDraft { tipo_prenda_id: number | ''; cantidad: number; color: string; descripcion: string; servicio_ids: number[] }
export type CatalogKind = 'servicios' | 'tipos-prenda' | 'metodos-pago'
