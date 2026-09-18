import { AlertTriangle, Edit3, Package, Plus, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createSupply, deactivateSupply, listSupplies, updateSupply, type SupplyPayload } from '../api/supplies'
import { errorMessage } from '../api/client'
import { Modal } from '../components/Modal'
import type { Insumo } from '../types'

const quantity = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 })

function SupplyForm({ supply, onClose, onSaved }: { supply: Insumo | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const values = new FormData(event.currentTarget)
    const nombre = String(values.get('nombre')).trim()
    const descripcion = String(values.get('descripcion')).trim()
    const unidadMedida = String(values.get('unidad_medida')).trim()
    const rawCurrent = String(values.get('stock_actual')).trim()
    const rawMinimum = String(values.get('stock_minimo')).trim()
    const stockActual = Number(rawCurrent)
    const stockMinimo = Number(rawMinimum)
    const decimalPattern = /^\d+(\.\d{1,2})?$/

    setError('')
    if (!nombre) { setError('El nombre es obligatorio.'); return }
    if (new TextEncoder().encode(nombre).length > 100) { setError('El nombre no puede superar los 100 caracteres.'); return }
    if (!unidadMedida) { setError('La unidad de medida es obligatoria.'); return }
    if (new TextEncoder().encode(unidadMedida).length > 20) { setError('La unidad de medida no puede superar los 20 caracteres.'); return }
    if (new TextEncoder().encode(descripcion).length > 255) { setError('La descripción no puede superar los 255 caracteres.'); return }
    if (!decimalPattern.test(rawCurrent) || stockActual < 0) { setError('El stock actual debe ser cero o un número positivo con máximo dos decimales.'); return }
    if (!decimalPattern.test(rawMinimum) || stockMinimo < 0) { setError('El stock mínimo debe ser cero o un número positivo con máximo dos decimales.'); return }

    const payload: SupplyPayload = {
      nombre,
      unidad_medida: unidadMedida,
      stock_actual: stockActual,
      stock_minimo: stockMinimo,
      ...(descripcion && { descripcion }),
    }
    setSaving(true)
    try {
      if (supply) await updateSupply(supply.id, { ...payload, descripcion })
      else await createSupply(payload)
      onSaved(`Insumo ${supply ? 'actualizado' : 'creado'} correctamente.`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return <form className="catalog-form supply-form" noValidate onSubmit={submit}>
    <label>Nombre *<input name="nombre" defaultValue={supply?.nombre ?? ''} maxLength={100} placeholder="Ej. Detergente líquido" autoFocus/></label>
    <label>Descripción<textarea name="descripcion" defaultValue={supply?.descripcion ?? ''} maxLength={255} rows={3} placeholder="Uso o características del insumo"/></label>
    <label>Unidad de medida *<input name="unidad_medida" defaultValue={supply?.unidad_medida ?? ''} maxLength={20} placeholder="Ej. litros, kg, unidades"/></label>
    <div className="form-grid">
      <label>Stock actual *<input name="stock_actual" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={supply?.stock_actual ?? 0}/></label>
      <label>Stock mínimo *<input name="stock_minimo" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={supply?.stock_minimo ?? 0}/></label>
    </div>
    {error && <div className="alert error" role="alert">{error}</div>}
    <footer><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar insumo'}</button></footer>
  </form>
}

export function SuppliesPage() {
  const [supplies, setSupplies] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<Insumo | null | undefined>()
  const requestVersion = useRef(0)

  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    try {
      const response = await listSupplies()
      if (version === requestVersion.current) setSupplies(response)
    } catch (cause) {
      if (version === requestVersion.current) { setSupplies([]); setError(errorMessage(cause)) }
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function toggle(supply: Insumo) {
    if (supply.activo && !confirm(`¿Desactivar “${supply.nombre}”?`)) return
    setError('')
    setSuccess('')
    try {
      if (supply.activo) await deactivateSupply(supply.id)
      else await updateSupply(supply.id, { activo: true })
      setSuccess(`${supply.nombre} fue ${supply.activo ? 'desactivado' : 'activado'} correctamente.`)
      await load()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const activeSupplies = supplies.filter(supply => supply.activo)
  const lowStock = activeSupplies.filter(supply => supply.stock_actual <= supply.stock_minimo).length

  return <>
    <section className="page-heading"><div><h1>Insumos</h1><p>Controla las existencias y los niveles mínimos del inventario.</p></div><button className="primary" onClick={() => setEditing(null)}><Plus size={19}/>Nuevo insumo</button></section>
    {success && <div className="alert success" role="status">{success}</div>}
    {error && <div className="alert error" role="alert"><span>{error}</span><button onClick={() => void load()}><RefreshCw size={16}/>Reintentar</button></div>}

    {!loading && supplies.length > 0 && <section className="inventory-summary" aria-label="Resumen de inventario"><article><Package size={22}/><span><b>{activeSupplies.length}</b> insumos activos</span></article><article className={lowStock ? 'warning' : ''}><AlertTriangle size={22}/><span><b>{lowStock}</b> con stock bajo</span></article></section>}

    <section className="catalog-card">
      {loading ? <div className="state" role="status"><span className="spinner"/>Cargando insumos…</div> : !supplies.length ? <div className="state"><Package size={40}/><b>Aún no hay insumos</b><span>Crea el primer registro para comenzar.</span></div> : <div className="table-scroll"><table className="supplies-table">
        <thead><tr><th>Insumo</th><th>Descripción</th><th>Stock actual</th><th>Stock mínimo</th><th>Nivel</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{supplies.map(supply => {
          const isLow = supply.activo && supply.stock_actual <= supply.stock_minimo
          return <tr key={supply.id} className={!supply.activo ? 'inactive-row' : ''}>
            <td className="entity-name"><span className="entity-icon"><Package size={18}/></span><span>{supply.nombre}<small>{supply.unidad_medida}</small></span></td>
            <td>{supply.descripcion || '—'}</td>
            <td className="stock-value" aria-label={`Stock actual: ${quantity.format(supply.stock_actual)} ${supply.unidad_medida}`}>{quantity.format(supply.stock_actual)} <small>{supply.unidad_medida}</small></td>
            <td aria-label={`Stock mínimo: ${quantity.format(supply.stock_minimo)} ${supply.unidad_medida}`}>{quantity.format(supply.stock_minimo)} <small>{supply.unidad_medida}</small></td>
            <td><span className={`stock-badge ${!supply.activo ? 'inactive' : isLow ? 'low' : 'ok'}`}>{!supply.activo ? 'Sin seguimiento' : isLow ? 'Stock bajo' : 'Disponible'}</span></td>
            <td><span className={`badge ${supply.activo ? 'active' : ''}`}>{supply.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td className="actions"><button onClick={() => setEditing(supply)}><Edit3 size={16}/>Editar</button><button onClick={() => void toggle(supply)}>{supply.activo ? 'Desactivar' : 'Activar'}</button></td>
          </tr>
        })}</tbody>
      </table></div>}
    </section>

    {editing !== undefined && <Modal title={`${editing ? 'Editar' : 'Nuevo'} insumo`} onClose={() => setEditing(undefined)}><SupplyForm supply={editing} onClose={() => setEditing(undefined)} onSaved={message => { setEditing(undefined); setSuccess(message); void load() }}/></Modal>}
  </>
}
