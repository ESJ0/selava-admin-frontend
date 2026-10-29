import { describe, expect, it } from 'vitest'
import { tokenIdentity } from './auth'

function token(payload: Record<string, unknown>) {
  return `header.${btoa(JSON.stringify(payload))}.signature`
}

describe('tokenIdentity', () => {
  it('acepta sesiones internas vigentes y conserva el rol', () => {
    const identity = tokenIdentity(token({ rol_id: 2, rol: 'Recepcionista', exp: Math.floor(Date.now() / 1000) + 60 }))

    expect(identity).toMatchObject({ roleId: 2, role: 'Recepcionista' })
  })

  it('rechaza tokens vencidos y roles que pertenecen al portal de clientes', () => {
    expect(tokenIdentity(token({ rol_id: 1, exp: Math.floor(Date.now() / 1000) - 1 }))).toBeNull()
    expect(tokenIdentity(token({ rol_id: 4, exp: Math.floor(Date.now() / 1000) + 60 }))).toBeNull()
  })
})
