import { Check, Plus } from 'lucide-react'
import type { Servicio } from '../types'

interface GarmentServiceSelectorProps {
  services: Servicio[]
  selectedIds: number[]
  onToggle: (serviceId: number) => void
}

function normalizedServiceName(name: string) {
  return name.trim().toLocaleLowerCase('es-GT').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function areIncompatible(first: string, second: string) {
  const names = new Set([normalizedServiceName(first), normalizedServiceName(second)])
  return names.has('lavado') && names.has('lavado en seco')
}

export function GarmentServiceSelector({ services, selectedIds, onToggle }: GarmentServiceSelectorProps) {
  if (!services.length) {
    return <div className="service-empty">No hay servicios activos disponibles para asignar.</div>
  }

  const hasExclusiveSelection = selectedIds.some((selectedId) => {
    const serviceName = services.find((service) => service.id === selectedId)?.nombre ?? ''
    const normalizedName = normalizedServiceName(serviceName)
    return normalizedName === 'lavado' || normalizedName === 'lavado en seco'
  })

  return <>
    <div className="service-selector-heading">
      <span>Servicios disponibles</span>
      <small>{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}</small>
    </div>
    <div className="service-options" role="group" aria-label="Servicios disponibles">
      {services.map((service) => {
        const selected = selectedIds.includes(service.id)
        const blocked = !selected && selectedIds.some((selectedId) => areIncompatible(service.nombre, services.find((selectedService) => selectedService.id === selectedId)?.nombre ?? ''))
        return <label className={selected ? 'selected' : ''} key={service.id}>
          <input type="checkbox" checked={selected} disabled={blocked} aria-label={service.nombre} onChange={() => onToggle(service.id)} />
          <span>
            <b>{service.nombre}</b>
            <small>Q{service.precio_base.toFixed(2)}</small>
          </span>
          <span className="service-action" aria-hidden="true">{selected ? <Check size={18} /> : <Plus size={18} />}</span>
        </label>
      })}
    </div>
    {hasExclusiveSelection && <div className="service-warning" role="status">Lavado y Lavado en seco no se pueden aplicar juntos por seguridad.</div>}
  </>
}
