import { Edit3, Plus, RefreshCw, Shirt } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createCatalog, deactivateCatalog, listCatalog, updateCatalog, type CatalogEntity, type CatalogPayload } from '../api/catalogs'
import { errorMessage } from '../api/client'
import { Modal } from '../components/Modal'
import { useAuth } from '../store/auth'
import type { CatalogKind, Servicio, TipoPrenda } from '../types'

const config = {
  servicios: { title: 'Servicios', subtitle: 'Gestiona los servicios que ofrece SeLava.', singular: 'servicio', button: 'Nuevo servicio' },
  'tipos-prenda': { title: 'Tipos de prenda', subtitle: 'Gestiona los tipos de prenda disponibles.', singular: 'tipo de prenda', button: 'Nuevo tipo' },
  'metodos-pago': { title: 'Métodos de pago', subtitle: 'Gestiona los métodos de pago aceptados.', singular: 'método de pago', button: 'Nuevo método' },
} satisfies Record<CatalogKind, { title: string; subtitle: string; singular: string; button: string }>

function CatalogForm({ kind, item, onClose, onSaved }: { kind: CatalogKind; item: CatalogEntity | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const servicio = kind === 'servicios' ? item as Servicio | null : null
  const tipo = kind === 'tipos-prenda' ? item as TipoPrenda | null : null
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); const values = new FormData(event.currentTarget)
    const payload: CatalogPayload = { nombre: String(values.get('nombre')).trim() }
    if (kind !== 'metodos-pago') payload.descripcion = String(values.get('descripcion')).trim()
    if (kind === 'servicios') { payload.precio_base = Number(values.get('precio_base')); const hours = Number(values.get('tiempo_estimado_horas')); if (hours) payload.tiempo_estimado_horas = hours }
    if (!payload.nombre) { setError('El nombre es obligatorio.'); setSaving(false); return }
    if (kind === 'servicios' && (!payload.precio_base || payload.precio_base <= 0)) { setError('El precio debe ser mayor que cero.'); setSaving(false); return }
    try { if (item) await updateCatalog(kind, item.id, payload); else await createCatalog(kind, payload); onSaved(`${config[kind].singular[0].toUpperCase()}${config[kind].singular.slice(1)} ${item ? 'actualizado' : 'creado'} correctamente.`) }
    catch (e) { setError(errorMessage(e)) } finally { setSaving(false) }
  }
  return <form className="catalog-form" onSubmit={submit}>
    <label>Nombre *<input name="nombre" defaultValue={item?.nombre} maxLength={100} required /></label>
    {kind !== 'metodos-pago' && <label>Descripción<textarea name="descripcion" defaultValue={servicio?.descripcion ?? tipo?.descripcion ?? ''} maxLength={500} rows={3}/></label>}
    {kind === 'servicios' && <div className="form-grid"><label>Precio base *<input name="precio_base" type="number" min="0.01" step="0.01" defaultValue={servicio?.precio_base} required /></label><label>Tiempo estimado (horas)<input name="tiempo_estimado_horas" type="number" min="1" step="1" defaultValue={servicio?.tiempo_estimado_horas}/></label></div>}
    {error && <div className="alert error">{error}</div>}<footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : `Guardar ${config[kind].singular}`}</button></footer>
  </form>
}

export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const [items, setItems] = useState<CatalogEntity[]>([]); const [loadedKind, setLoadedKind] = useState<CatalogKind | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [editing, setEditing] = useState<CatalogEntity | null | undefined>(); const requestVersion = useRef(0)
  const isAdmin = useAuth((s) => s.roleId) === 1
  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true); setError('')
    try {
      const response = await listCatalog(kind)
      if (version === requestVersion.current) { setItems(response); setLoadedKind(kind) }
    } catch (e) {
      if (version === requestVersion.current) { setItems([]); setLoadedKind(kind); setError(errorMessage(e)) }
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [kind])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  async function toggle(item: CatalogEntity) {
    if (item.activo && !confirm(`¿Desactivar “${item.nombre}”?`)) return
    try { if (item.activo) await deactivateCatalog(kind, item.id); else await updateCatalog(kind, item.id, { activo: true }); setSuccess(`${item.nombre} fue ${item.activo ? 'desactivado' : 'activado'} correctamente.`); await load() } catch (e) { setError(errorMessage(e)) }
  }
  const meta = config[kind]
  const catalogLoading = loading || loadedKind !== kind
  return <><section className="page-heading"><div><h1>{meta.title}</h1><p>{meta.subtitle}</p></div>{isAdmin && <button className="primary" onClick={() => setEditing(null)}><Plus size={19}/>{meta.button}</button>}</section>
    {success && <div className="alert success">{success}</div>}{error && <div className="alert error"><span>{error}{kind === 'metodos-pago' && ' El endpoint aún no está integrado en la rama develop del backend.'}</span><button onClick={load}><RefreshCw size={16}/> Reintentar</button></div>}
    <section className="catalog-card">
      {catalogLoading ? <div className="state"><span className="spinner"/>Cargando {meta.title.toLowerCase()}…</div> : !items.length ? <div className="state"><Shirt size={40}/><b>Aún no hay {meta.title.toLowerCase()}</b><span>Crea el primer registro para comenzar.</span></div> :
      <div className="table-scroll"><table><thead><tr><th>{kind === 'tipos-prenda' ? 'Tipo' : kind === 'servicios' ? 'Servicio' : 'Método'}</th>{kind !== 'metodos-pago' && <th>Descripción</th>}{kind === 'servicios' && <><th>Precio base</th><th>Tiempo est.</th></>}<th>Estado</th>{isAdmin && <th>Acciones</th>}</tr></thead>
        <tbody>{items.map((item) => { const service = item as Servicio; const described = item as TipoPrenda; return <tr key={item.id}><td className="entity-name"><span className="entity-icon"><Shirt size={18}/></span>{item.nombre}</td>{kind !== 'metodos-pago' && <td>{described.descripcion || '—'}</td>}{kind === 'servicios' && <><td className="money">Q{Number(service.precio_base ?? 0).toFixed(2)}</td><td>{service.tiempo_estimado_horas ? `${service.tiempo_estimado_horas} h` : '—'}</td></>}<td><span className={`badge ${item.activo ? 'active' : ''}`}>{item.activo ? 'Activo' : 'Inactivo'}</span></td>{isAdmin && <td className="actions"><button onClick={() => setEditing(item)}><Edit3 size={16}/>Editar</button><button onClick={() => void toggle(item)}>{item.activo ? 'Desactivar' : 'Activar'}</button></td>}</tr> })}</tbody>
      </table></div>}
    </section>
    {editing !== undefined && <Modal title={`${editing ? 'Editar' : 'Nuevo'} ${meta.singular}`} onClose={() => setEditing(undefined)}><CatalogForm kind={kind} item={editing} onClose={() => setEditing(undefined)} onSaved={(message) => { setEditing(undefined); setSuccess(message); void load() }}/></Modal>}
  </>
}
