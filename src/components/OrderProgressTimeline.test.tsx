import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FlujoOperativoPedido } from '../types'
import { OrderProgressTimeline } from './OrderProgressTimeline'

const flow: FlujoOperativoPedido = {
  progreso_porcentaje: 50,
  cancelado: false,
  siguiente_estado: { id: 3, nombre: 'Rackeado', codigo: 'RACKEADO', orden: 50 },
  estados: [
    { id: 1, nombre: 'Recibido', codigo: 'RECIBIDO', orden: 10, servicios: [], completado: true, actual: false },
    { id: 2, nombre: 'En lavado', codigo: 'EN_LAVADO', orden: 20, servicios: [{ id: 7, nombre: 'Lavado' }], completado: true, actual: true },
    { id: 3, nombre: 'Rackeado', codigo: 'RACKEADO', orden: 50, servicios: [], completado: false, actual: false },
    { id: 4, nombre: 'Finalizado', codigo: 'FINALIZADO', orden: 60, servicios: [], completado: false, actual: false },
  ],
}

describe('OrderProgressTimeline', () => {
  it('distingue etapas completadas, actual y pendientes', () => {
    render(<OrderProgressTimeline flow={flow}/>)

    expect(screen.getByRole('listitem', { name: 'Recibido: Completado' })).toHaveClass('done')
    expect(screen.getByRole('listitem', { name: 'En lavado: Estado actual' })).toHaveClass('current')
    expect(screen.getByRole('listitem', { name: 'Rackeado: Pendiente' })).toHaveClass('pending')
    expect(screen.getByRole('listitem', { name: 'Finalizado: Pendiente' })).toHaveClass('pending')
    expect(screen.getByRole('listitem', { name: 'En lavado: Estado actual' })).toHaveAttribute('aria-current', 'step')
  })

  it('asigna un icono representativo a cada etapa', () => {
    render(<OrderProgressTimeline flow={flow}/>)

    for (const stage of flow.estados) {
      expect(screen.getByRole('img', { name: `Icono de ${stage.nombre}` })).toBeInTheDocument()
    }
  })

  it('renderiza únicamente las etapas aplicables recibidas del backend', () => {
    const tailored: FlujoOperativoPedido = {
      ...flow,
      estados: [flow.estados[0], {
        id: 8, nombre: 'En planchado', codigo: 'EN_PLANCHADO', orden: 40,
        servicios: [{ id: 9, nombre: 'Planchado' }], completado: false, actual: true,
      }, flow.estados[2], flow.estados[3]],
    }
    render(<OrderProgressTimeline flow={tailored}/>)

    const timeline = screen.getByRole('list', { name: 'Etapas del pedido' })
    expect(within(timeline).queryByText('En lavado')).not.toBeInTheDocument()
    expect(within(timeline).getByText('En planchado')).toBeInTheDocument()
    expect(within(timeline).getByText('Aplica por: Planchado')).toBeInTheDocument()
  })
})
