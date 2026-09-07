import { describe, expect, it } from 'vitest'
import { errorMessage } from './client'

describe('errorMessage', () => {
  it('formatea el arreglo de validaciones del backend', () => {
    const error = { isAxiosError: true, response: { data: { errores: [{ field: 'nombre', message: 'es requerido' }] } } }
    expect(errorMessage(error)).toBe('nombre: es requerido')
  })
  it.each([400, 401, 403, 404, 409, 422, 500])('muestra un mensaje para HTTP %s sin cuerpo legible', (status) => {
    const message = errorMessage({ isAxiosError: true, response: { status, data: { error: { detail: 'internal' }, errores: { invalid: {} } } } })
    expect(typeof message).toBe('string')
    expect(message).not.toContain('[object Object]')
    expect(message).not.toContain('inesperado')
  })
  it('tolera errores de validación malformados', () => {
    expect(errorMessage({ isAxiosError: true, response: { status: 422, data: { errores: [null, {}, { message: { internal: true } }, { field: 'estado', message: 'no disponible' }] } } })).toBe('estado: no disponible')
  })
  it('conserva el rechazo humano de cancelacion', () => {
    expect(errorMessage({ isAxiosError: true, response: { status: 409, data: { error: 'el pedido no se puede cancelar en su estado actual' } } })).toContain('no se puede cancelar')
  })
  it('maneja desconexion sin respuesta HTTP', () => {
    expect(errorMessage({ isAxiosError: true })).toContain('conectar')
  })
})
