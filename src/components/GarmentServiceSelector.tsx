import type { Servicio } from '../types'
import { CheckIcon } from './admin/icons'

interface GarmentServiceSelectorProps {
  services: Servicio[]
  selectedIds: number[]
  onToggle: (serviceId: number) => void
  title?: string
}

function normalizedServiceName(name: string) {
  return name.trim().toLocaleLowerCase('es-GT').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function areIncompatible(first: string, second: string) {
  const names = new Set([normalizedServiceName(first), normalizedServiceName(second)])
  return names.has('lavado') && names.has('lavado en seco')
}

export function GarmentServiceSelector({ services, selectedIds, onToggle, title = 'Servicios disponibles' }: GarmentServiceSelectorProps) {
  if (!services.length) {
    return <p className="ad-muted" style={{ margin: 0, padding: 14, borderRadius: 14, border: '1.5px dashed #DCE7EC', textAlign: 'center' }}>No hay servicios activos disponibles para asignar.</p>
  }

  const hasExclusiveSelection = selectedIds.some((selectedId) => {
    const normalizedName = normalizedServiceName(services.find((service) => service.id === selectedId)?.nombre ?? '')
    return normalizedName === 'lavado' || normalizedName === 'lavado en seco'
  })

  return <>
    <p className="ad-lbl2" style={{ display: 'flex', justifyContent: 'space-between' }}>{title} <span style={{ fontWeight: 500, color: '#5A7280' }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}</span></p>
    <div className="ad-svcs" role="group" aria-label={title}>
      {services.map((service) => {
        const selected = selectedIds.includes(service.id)
        const blocked = !selected && selectedIds.some((selectedId) => areIncompatible(service.nombre, services.find((selectedService) => selectedService.id === selectedId)?.nombre ?? ''))
        return <button key={service.id} type="button" role="checkbox" aria-checked={selected} aria-label={service.nombre} className="ad-svc" disabled={blocked} onClick={() => onToggle(service.id)}>
          <span className="cb"><CheckIcon size={12} strokeWidth={3.6} /></span>
          <span><b>{service.nombre}</b>{service.descripcion && <small>{service.descripcion}</small>}</span>
        </button>
      })}
    </div>
    {hasExclusiveSelection && <p className="ad-svc-warn" role="status">Lavado y Lavado en seco no se pueden aplicar juntos por seguridad.</p>}
  </>
}
