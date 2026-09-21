import { ArrowDownToLine, Boxes, Edit3, PackageOpen, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createInput, deactivateInput, listInputs, registerInventoryMovement, updateInput } from '../api/inventory'
import { errorMessage } from '../api/client'
import { Modal } from '../components/Modal'
import { useAuth } from '../store/auth'
import type { Insumo, TipoMovimientoInventario } from '../types'

function InventoryForm({ item, onClose, onSaved }: { item: Insumo | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const values = new FormData(event.currentTarget)
    const nombre = String(values.get('nombre')).trim()
    const unidad = String(values.get('unidad_medida')).trim()
    const descripcion = String(values.get('descripcion')).trim()
    const stockActualText = String(values.get('stock_actual'))
    const stockMinimoText = String(values.get('stock_minimo'))
    const stockActual = Number(stockActualText)
    const stockMinimo = Number(stockMinimoText)
    if (!nombre) { setError('El nombre es obligatorio.'); return }
    if (!unidad) { setError('La unidad de medida es obligatoria.'); return }
    if (!stockActualText || !Number.isFinite(stockActual) || stockActual < 0) { setError('El stock actual no puede ser negativo.'); return }
    if (!stockMinimoText || !Number.isFinite(stockMinimo) || stockMinimo < 0) { setError('El stock mínimo no puede ser negativo.'); return }
    setSaving(true)
    try {
      const payload = {
        nombre,
        unidad_medida: unidad,
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
        ...(descripcion && { descripcion }),
      }
      if (item) await updateInput(item.id, payload)
      else await createInput(payload)
      onSaved(`Insumo ${item ? 'actualizado' : 'creado'} correctamente.`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return <form className="catalog-form" aria-label="Formulario de insumo" onSubmit={submit}>
    <label>Nombre *<input name="nombre" defaultValue={item?.nombre} maxLength={100} required /></label>
    <label>Descripción<textarea name="descripcion" defaultValue={item?.descripcion ?? ''} maxLength={255} rows={3}/></label>
    <div className="form-grid">
      <label>Unidad de medida *<input name="unidad_medida" defaultValue={item?.unidad_medida} maxLength={20} placeholder="L, kg, unidad…" required /></label>
      <label>Stock actual *<input name="stock_actual" type="number" min="0" step="0.01" defaultValue={item?.stock_actual ?? 0} required /></label>
    </div>
    <label>Stock mínimo *<input name="stock_minimo" type="number" min="0" step="0.01" defaultValue={item?.stock_minimo ?? 0} required /></label>
    {error && <div className="alert error" role="alert">{error}</div>}
    <footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar insumo'}</button></footer>
  </form>
}

function MovementForm({ items, onClose, onSaved }: { items: Insumo[]; onClose: () => void; onSaved: (message: string) => void }) {
  const [inputId, setInputId] = useState('')
  const [movementType, setMovementType] = useState<TipoMovimientoInventario | ''>('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = items.find((item) => item.id === Number(inputId))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const numericInput = Number(inputId)
    const numericQuantity = Number(quantity)
    if (!inputId || !Number.isInteger(numericInput) || numericInput <= 0 || !selected) {
      setError('Selecciona un insumo.')
      return
    }
    if (movementType !== 'entrada' && movementType !== 'salida') {
      setError('Selecciona un tipo de movimiento.')
      return
    }
    if (!quantity || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setError('La cantidad debe ser mayor que cero.')
      return
    }
    if (movementType === 'salida' && numericQuantity > selected.stock_actual) {
      setError('La cantidad solicitada supera el stock disponible.')
      return
    }
    setSaving(true)
    try {
      await registerInventoryMovement({
        insumo_id: numericInput,
        tipo_movimiento: movementType,
        cantidad: numericQuantity,
        ...(reason.trim() && { motivo: reason.trim() }),
      })
      onSaved(`${movementType === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente.`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return <form className="catalog-form movement-form" aria-label="Formulario de movimiento de inventario" onSubmit={submit}>
    <label>Insumo *<select name="insumo_id" aria-label="Insumo" value={inputId} onChange={(event) => setInputId(event.target.value)} required><option value="">Seleccionar insumo</option>{items.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
    {selected && <div className="current-stock" role="status"><span>Stock actual</span><strong>{selected.stock_actual} {selected.unidad_medida}</strong></div>}
    <div className="form-grid">
      <label>Tipo de movimiento *<select name="tipo_movimiento" aria-label="Tipo de movimiento" value={movementType} onChange={(event) => setMovementType(event.target.value as TipoMovimientoInventario | '')} required><option value="">Seleccionar tipo</option><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label>
      <label>{movementType === 'salida' ? 'Cantidad a retirar *' : 'Cantidad *'}<input name="cantidad" aria-label="Cantidad" type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
    </div>
    {movementType === 'salida' && selected && <p className="stock-help">Disponible para retirar: <strong>{selected.stock_actual} {selected.unidad_medida}</strong></p>}
    <label>Motivo u observación<textarea name="motivo" aria-label="Motivo u observación" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} rows={3} placeholder="Opcional" /></label>
    {error && <div className="alert error" role="alert">{error}</div>}
    <footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar movimiento'}</button></footer>
  </form>
}

export function InventoryPage() {
  const roleId = useAuth((state) => state.roleId)
  const canManage = roleId === 1 || roleId === 2
  const canRegisterMovement = roleId === 1 || roleId === 3
  const [items, setItems] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<Insumo | null | undefined>()
  const [moving, setMoving] = useState(false)
  const request = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await listInputs(controller.signal)
      if (!controller.signal.aborted) setItems(response ?? [])
    } catch (cause) {
      if (!controller.signal.aborted) { setItems([]); setError(errorMessage(cause)) }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [load])

  async function toggle(item: Insumo) {
    if (item.activo && !confirm(`¿Desactivar “${item.nombre}”?`)) return
    setError('')
    setSuccess('')
    try {
      if (item.activo) await deactivateInput(item.id)
      else await updateInput(item.id, { activo: true })
      setSuccess(`${item.nombre} fue ${item.activo ? 'desactivado' : 'activado'} correctamente.`)
      await load()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return <>
    <section className="page-heading"><div><h1>Insumos</h1><p>Gestiona existencias, unidades de medida y niveles mínimos.</p></div><div className="heading-actions">{canRegisterMovement && <button className="secondary" onClick={() => setMoving(true)}><ArrowDownToLine size={19}/>Registrar movimiento</button>}{canManage && <button className="primary" onClick={() => setEditing(null)}><Plus size={19}/>Nuevo insumo</button>}</div></section>
    {success && <div className="alert success" role="status">{success}</div>}
    {error && <div className="alert error" role="alert"><span>{error}</span><button onClick={() => void load()}><RefreshCw size={16}/>Reintentar</button></div>}
    <section className="catalog-card">
      {loading ? <div className="state" role="status"><span className="spinner"/>Cargando insumos…</div> : !items.length ? <div className="state"><PackageOpen size={40}/><b>Aún no hay insumos</b><span>Crea el primer registro para comenzar.</span></div> : <div className="table-scroll"><table><thead><tr><th>Insumo</th><th>Unidad</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="entity-name"><span className="entity-icon"><Boxes size={18}/></span><span>{item.nombre}{item.descripcion && <small className="unit-price">{item.descripcion}</small>}</span></td><td>{item.unidad_medida}</td><td>{item.stock_actual}</td><td>{item.stock_minimo}</td><td><span className={`badge ${item.activo ? 'active' : ''}`}>{item.activo ? 'Activo' : 'Inactivo'}</span></td>{canManage && <td className="actions"><button onClick={() => setEditing(item)}><Edit3 size={16}/>Editar</button><button onClick={() => void toggle(item)}>{item.activo ? 'Desactivar' : 'Activar'}</button></td>}</tr>)}</tbody></table></div>}
    </section>
    {editing !== undefined && <Modal title={`${editing ? 'Editar' : 'Nuevo'} insumo`} onClose={() => setEditing(undefined)}><InventoryForm item={editing} onClose={() => setEditing(undefined)} onSaved={(message) => { setEditing(undefined); setSuccess(message); void load() }}/></Modal>}
    {moving && <Modal title="Registrar movimiento" onClose={() => setMoving(false)}><MovementForm items={items.filter((item) => item.activo)} onClose={() => setMoving(false)} onSaved={(message) => { setMoving(false); setSuccess(message); void load() }}/></Modal>}
  </>
}
