import { useEffect, useState, type FormEvent } from 'react'
import { listPromotions, savePromotion, setPromotionActive } from '../api/promotions'
import { listGarmentTypes } from '../api/orders'
import { errorMessage } from '../api/client'
import { Modal } from '../components/Modal'
import { promotionMeasure, promotionMoney } from '../utils/promotionFormat'
import { useAuth } from '../store/auth'
import type { TipoPrenda } from '../types'
import type { Promotion, PromotionPayload } from '../types/promotion'

const localDateTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function PromotionForm({ item, types, onClose, onSaved }: { item: Promotion | null; types: TipoPrenda[]; onClose: () => void; onSaved: () => void }) {
  const [typeId, setTypeId] = useState(item?.tipo_prenda_id ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const type = types.find(t => t.id === typeId)
  const mode = type?.modalidad_cobro ?? 'UNIDAD'
  const label = mode === 'LIBRA' ? 'Libras requeridas' : mode === 'METRO' ? 'Metros requeridos' : 'Cantidad requerida'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return
    const data = new FormData(event.currentTarget)
    const nombre = String(data.get('nombre') ?? '').trim()
    const rawPrice = String(data.get('precio_promocional') ?? '')
    const rawMeasure = String(data.get('medida_requerida') ?? '')
    const start = new Date(String(data.get('fecha_inicio') ?? ''))
    const end = new Date(String(data.get('fecha_fin') ?? ''))
    if (!nombre || !type?.activo) return setError('Ingresa un nombre y selecciona un tipo de prenda activo.')
    if (!/^\d+(?:\.\d{1,2})?$/.test(rawPrice) || Number(rawPrice) <= 0 || Number(rawPrice) > 99999999.99) return setError('El precio debe ser positivo, con hasta dos decimales y no superar Q99,999,999.99.')
    if (!/^\d+(?:\.\d{1,3})?$/.test(rawMeasure) || Number(rawMeasure) <= 0 || Number(rawMeasure) > 99999999.999 || (mode === 'UNIDAD' && !Number.isInteger(Number(rawMeasure)))) return setError('La medida debe ser positiva: entera para UNIDAD y con hasta tres decimales para LIBRA/METRO.')
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return setError('Ingresa fechas válidas; el inicio no puede ser posterior al fin.')
    const payload: PromotionPayload = { nombre, descripcion: String(data.get('descripcion') ?? '').trim(), tipo_prenda_id: typeId, modalidad_cobro: mode, medida_requerida: Number(rawMeasure), precio_promocional: Number(rawPrice), fecha_inicio: start.toISOString(), fecha_fin: end.toISOString(), activo: data.get('activo') === 'on' }
    setSaving(true); setError('')
    try { await savePromotion(payload, item?.id); onSaved() } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }
  return <form className="catalog-form promotion-form" onSubmit={submit} noValidate>
    <fieldset disabled={saving}>
      <label>Nombre *<input name="nombre" defaultValue={item?.nombre ?? ''} maxLength={100} required /></label>
      <label>Descripción<textarea name="descripcion" defaultValue={item?.descripcion ?? ''} maxLength={500} rows={2} /></label>
      <label>Tipo de prenda *<select value={typeId || ''} onChange={event => setTypeId(Number(event.target.value))}><option value="">Seleccionar tipo</option>{types.map(t => <option key={t.id} value={t.id} disabled={!t.activo}>{t.nombre}{!t.activo ? ' (inactivo)' : ''}</option>)}</select></label>
      <p>Modalidad: <strong>{mode}</strong></p>
      <div className="form-grid"><label>{label} *<input name="medida_requerida" type="number" min={mode === 'UNIDAD' ? 1 : 0.001} max="99999999.999" step={mode === 'UNIDAD' ? 1 : 0.001} defaultValue={item?.medida_requerida ?? ''} /></label><label>Precio promocional (Q) *<input name="precio_promocional" type="number" min="0.01" step="0.01" max="99999999.99" defaultValue={item?.precio_promocional ?? ''} /></label></div>
      <div className="form-grid"><label>Inicio *<input name="fecha_inicio" type="datetime-local" defaultValue={localDateTime(item?.fecha_inicio)} /></label><label>Fin *<input name="fecha_fin" type="datetime-local" defaultValue={localDateTime(item?.fecha_fin)} /></label></div>
      <label className="promotion-active"><input name="activo" type="checkbox" defaultChecked={item?.activo ?? true} />Activa</label>
    </fieldset>
    {error && <div role="alert" className="alert error">{error}</div>}
    <footer><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar promoción'}</button></footer>
  </form>
}

function validity(item: Promotion) {
  if (!item.activo) return 'Inactiva'
  const now = Date.now()
  return now < Date.parse(item.fecha_inicio) ? 'Programada' : now > Date.parse(item.fecha_fin) ? 'Vencida' : 'Vigente'
}
export function PromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([])
  const [types, setTypes] = useState<TipoPrenda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<Promotion | null | undefined>()
  const [busy, setBusy] = useState<number | null>(null)
  const [reload, setReload] = useState(0)
  const canManage = useAuth(state => state.roleId) === 1
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
    setLoading(true); setError('')
    Promise.all([listPromotions(controller.signal), listGarmentTypes()]).then(([promotions, garmentTypes]) => {
      if (controller.signal.aborted) return
      setItems(promotions); setTypes(garmentTypes)
    }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [reload])
  async function toggle(item: Promotion) {
    if (busy != null) return
    setBusy(item.id); setError('')
    try { await setPromotionActive(item.id, !item.activo); setNotice(`Promoción ${item.activo ? 'desactivada' : 'activada'}.`); setReload(n => n + 1) } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(null) }
  }
  return <>
    <section className="page-heading"><div><h1>Promociones</h1><p>Gestiona paquetes por unidad, libra o metro sin cambiar las tarifas base.</p></div>{canManage && <button className="primary" onClick={() => setEditing(null)}>Nueva promoción</button>}</section>
    {notice && <div role="status" className="alert success">{notice}</div>}
    {error && <div role="alert" className="alert error">{error}<button onClick={() => setReload(n => n + 1)}>Reintentar</button></div>}
    <section className="catalog-card">
      {loading ? <p className="state" role="status">Cargando promociones…</p> : error ? null : items.length === 0 ? <p className="state">Aún no hay promociones.</p> : <div className="table-scroll"><table><thead><tr><th>Promoción</th><th>Tipo y modalidad</th><th>Paquete</th><th>Vigencia</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>{items.map(item => <tr key={item.id}>
        <td><strong>{item.nombre}</strong><p>{item.descripcion}</p></td><td>{item.tipo_prenda_nombre}<p>{item.modalidad_cobro}</p></td><td>{promotionMeasure(item.medida_requerida, item.modalidad_cobro)}<p>{promotionMoney(item.precio_promocional)}</p></td>
        <td><time>{new Date(item.fecha_inicio).toLocaleString('es-GT')}</time><br /><time>{new Date(item.fecha_fin).toLocaleString('es-GT')}</time></td><td>{validity(item)}</td>{canManage && <td className="actions"><button disabled={busy != null} onClick={() => setEditing(item)}>Editar</button><button disabled={busy != null} onClick={() => void toggle(item)}>{item.activo ? 'Desactivar' : 'Activar'}</button></td>}
      </tr>)}</tbody></table></div>}
    </section>
    {editing !== undefined && <Modal title={editing ? 'Editar promoción' : 'Nueva promoción'} onClose={() => setEditing(undefined)}><PromotionForm item={editing} types={types} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setNotice('Promoción guardada correctamente.'); setReload(n => n + 1) }} /></Modal>}
  </>
}
