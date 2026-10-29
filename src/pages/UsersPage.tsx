import { Edit3, Plus, RefreshCw, UserCog } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createUser, listUsers, setUserActive, updateUser, type UserAccount, type UserPayload } from '../api/users'
import { errorMessage } from '../api/client'
import { Modal } from '../components/Modal'

const roles = [{ id: 1, name: 'Administrador' }, { id: 2, name: 'Recepcionista' }, { id: 4, name: 'Cliente' }]
function UserForm({ item, onClose, onSaved }: { item: UserAccount | null; onClose: () => void; onSaved: () => void }) {
  const [roleId, setRoleId] = useState(item?.rol_id ?? 2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const data = new FormData(event.currentTarget); const value = (name: string) => String(data.get(name) ?? '').trim()
    const phone = value('telefono')
    const payload: UserPayload = item
      ? { nombre: value('nombre'), apellido: value('apellido'), email: value('email').toLowerCase(), ...(phone ? { telefono: phone } : {}) }
      : { rol_id: roleId, email: value('email').toLowerCase(), password: value('password'), nombre: value('nombre'), apellido: value('apellido'), telefono: value('telefono'), direccion: value('direccion') }
    try { if (item) await updateUser(item.id, payload); else await createUser(payload); onSaved() }
    catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }
  const needsProfile = roleId === 2 || roleId === 4 || Boolean(item)
  return <form className="catalog-form user-form" onSubmit={submit}>
    {!item && <label>Tipo de usuario *<select value={roleId} onChange={event => setRoleId(Number(event.target.value))}>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>}
    {needsProfile && <div className="form-grid"><label>Nombre *<input name="nombre" defaultValue={item?.nombre ?? ''} required/></label><label>Apellido *<input name="apellido" defaultValue={item?.apellido ?? ''} required/></label></div>}
    <label>Correo electrónico *<input name="email" type="email" defaultValue={item?.email ?? ''} required autoComplete="off"/></label>
    {needsProfile && <label>Teléfono *<input name="telefono" defaultValue={item?.telefono ?? ''} required={roleId !== 1}/></label>}
    {!item && roleId === 4 && <label>Dirección<input name="direccion"/></label>}
    {!item && <label>Contraseña *<input name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password"/></label>}
    {error && <div className="alert error" role="alert">{error}</div>}
    <footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : item ? 'Guardar cambios' : 'Crear usuario'}</button></footer>
  </form>
}

export function UsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [editing, setEditing] = useState<UserAccount | null | undefined>()
  const load = useCallback(async () => { setLoading(true); setError(''); try { setUsers(await listUsers()) } catch (cause) { setError(errorMessage(cause)) } finally { setLoading(false) } }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  async function toggle(user: UserAccount) { try { await setUserActive(user.id, !user.activo); setNotice(`${user.email} fue ${user.activo ? 'desactivado' : 'activado'}.`); await load() } catch (cause) { setError(errorMessage(cause)) } }
  return <><section className="page-heading"><div><h1>Usuarios</h1><p>Administra cuentas, roles y acceso a SeLava.</p></div><button className="primary" onClick={() => setEditing(null)}><Plus size={19}/>Nuevo usuario</button></section>
    {notice && <div className="alert success">{notice}</div>}{error && <div className="alert error"><span>{error}</span><button onClick={() => void load()}><RefreshCw size={16}/>Reintentar</button></div>}
    <section className="catalog-card">{loading ? <div className="state"><span className="spinner"/>Cargando usuarios…</div> : !users.length ? <div className="state"><UserCog size={40}/><b>Aún no hay usuarios</b></div> : <div className="table-scroll"><table className="users-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><div className="user-identity"><strong>{user.nombre} {user.apellido}</strong><small>{user.email}</small><small>{user.telefono || 'Sin teléfono'}</small></div></td><td><span className="badge">{user.rol}</span></td><td><span className={`badge ${user.activo ? 'active' : ''}`}>{user.activo ? 'Activo' : 'Inactivo'}</span></td><td className="actions"><button onClick={() => setEditing(user)}><Edit3 size={16}/>Editar</button><button onClick={() => void toggle(user)}>{user.activo ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody></table></div>}</section>
    {editing !== undefined && <Modal title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setEditing(undefined)}><UserForm item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setNotice('Usuario guardado correctamente.'); void load() }}/></Modal>}
  </>
}
