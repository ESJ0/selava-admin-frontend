import { describe, expect, it } from 'vitest'
import { errorMessage } from './client'

describe('errorMessage', () => {
  it('formatea el arreglo de validaciones del backend', () => {
    const error = { isAxiosError: true, response: { data: { errores: [{ field: 'nombre', message: 'es requerido' }] } } }
    expect(errorMessage(error)).toBe('nombre: es requerido')
  })
})
