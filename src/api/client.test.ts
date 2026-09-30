import { describe, expect, it } from 'vitest'
import { errorMessage } from './client'

function axiosError(status?: number, data?: unknown) {
  return { isAxiosError: true, response: status ? { status, data } : undefined }
}

describe('errorMessage', () => {
  it('formatea el arreglo de validaciones del backend', () => {
    const error = axiosError(422, { errores: [{ field: 'nombre', message: 'es requerido' }] })
    expect(errorMessage(error)).toBe('nombre: es requerido')
  })

  it.each([400, 401, 403, 404, 409, 422, 500])('muestra un mensaje para HTTP %s sin cuerpo legible', (status) => {
    const message = errorMessage(axiosError(status, { error: { detail: 'internal' }, errores: { invalid: {} } }))
    expect(typeof message).toBe('string')
    expect(message).not.toContain('[object Object]')
    expect(message).not.toContain('inesperado')
  })

  it('tolera errores de validación malformados', () => {
    expect(errorMessage(axiosError(422, { errores: [null, {}, { message: { internal: true } }, { field: 'estado', message: 'no disponible' }] }))).toBe('estado: no disponible')
  })

  it.each([
    [401, 'Tu sesión terminó. Inicia sesión nuevamente.'],
    [403, 'No tienes permiso para realizar esta acción.'],
    [500, 'No pudimos completar la operación. Inténtalo nuevamente.'],
  ])('traduce %i a un mensaje humano', (status, expected) => {
    expect(errorMessage(axiosError(status, { error: 'mensaje técnico' }))).toBe(expected)
  })

  it('conserva conflictos útiles enviados por backend', () => {
    expect(errorMessage(axiosError(409, { error: 'stock insuficiente para registrar la salida' }))).toBe('stock insuficiente para registrar la salida')
  })

  it('conserva el rechazo humano de cancelación', () => {
    expect(errorMessage(axiosError(409, { error: 'el pedido no se puede cancelar en su estado actual' }))).toContain('no se puede cancelar')
  })

  it('distingue un problema de conexión', () => {
    expect(errorMessage(axiosError())).toBe('No fue posible conectar con el servidor.')
  })
})
