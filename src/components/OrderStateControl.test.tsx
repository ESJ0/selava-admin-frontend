import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FlujoOperativoPedido } from '../types'
import { OrderStateControl } from './OrderStateControl'

const baseFlow: FlujoOperativoPedido = {
  estados: [], progreso_porcentaje: 50, cancelado: false,
  siguiente_estado: { id: 2, nombre: 'En lavado', codigo: 'EN_LAVADO', orden: 20 },
}

function renderControl(flow = baseFlow, submitting = false) {
  const onAdvance = vi.fn()
  const onObservationsChange = vi.fn()
  render(<OrderStateControl flow={flow} observations="" submitting={submitting} onAdvance={onAdvance} onObservationsChange={onObservationsChange}/>)
  return { onAdvance, onObservationsChange }
}

describe('OrderStateControl', () => {
  it('avanza directamente cuando la siguiente etapa no es terminal', async () => {
    const { onAdvance } = renderControl()
    await userEvent.click(screen.getByRole('button', { name: 'Avanzar a En lavado' }))
    expect(onAdvance).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('solicita confirmación antes de marcar como Finalizado', async () => {
    const finalFlow = {
      ...baseFlow,
      siguiente_estado: { id: 4, nombre: 'Finalizado', codigo: 'FINALIZADO', orden: 60, es_terminal: true },
    }
    const { onAdvance } = renderControl(finalFlow)

    await userEvent.click(screen.getByRole('button', { name: 'Avanzar a Finalizado' }))
    expect(onAdvance).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Finalizar pedido' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, finalizar pedido' }))
    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('deshabilita el control mientras se guarda el cambio', () => {
    renderControl(baseFlow, true)
    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled()
    expect(screen.getByLabelText('Observaciones')).toBeDisabled()
  })
})
