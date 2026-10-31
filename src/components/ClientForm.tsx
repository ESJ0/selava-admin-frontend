import { useEffect, useState, type FormEvent } from 'react'
import { clientFieldErrors, createClient, updateClient } from '../api/clients'
import { errorMessage } from '../api/client'
import type { Cliente, ClienteCreate } from '../types'
import { initials } from '../utils/adminFormat'
import { CheckIcon, CloseIcon, InfoIcon, SpinnerIcon } from './admin/icons'

type FieldErrors = Partial<Record<keyof ClienteCreate, string>>
type Values = Required<ClienteCreate>

const namePattern = /^[\p{L}\s'-]+$/u
const phonePattern = /^\+?[0-9\s-]{8,15}$/
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function validate(payload: Values): FieldErrors {
  const errors: FieldErrors = {}
  if (!payload.nombre) errors.nombre = 'El nombre es obligatorio.'
  else if (payload.nombre.length > 100) errors.nombre = 'No puede superar los 100 caracteres.'
  else if (!namePattern.test(payload.nombre)) errors.nombre = 'Solo puede contener letras, espacios, apóstrofes y guiones.'
  if (!payload.apellido) errors.apellido = 'El apellido es obligatorio.'
  else if (payload.apellido.length > 100) errors.apellido = 'No puede superar los 100 caracteres.'
  else if (!namePattern.test(payload.apellido)) errors.apellido = 'Solo puede contener letras, espacios, apóstrofes y guiones.'
  if (!payload.telefono) errors.telefono = 'El teléfono es obligatorio.'
  else if (payload.telefono.length > 20 || !phonePattern.test(payload.telefono)) errors.telefono = 'Debe tener entre 8 y 15 caracteres y usar solo números, +, espacios o guiones.'
  if (payload.email && (payload.email.length > 150 || !emailPattern.test(payload.email))) errors.email = 'Ingresa un correo electrónico válido.'
  if (payload.direccion && payload.direccion.length > 255) errors.direccion = 'No puede superar los 255 caracteres.'
  return errors
}

const trimmed = (values: Values): Values => ({
  nombre: values.nombre.trim(), apellido: values.apellido.trim(), telefono: values.telefono.trim(), email: values.email.trim(), direccion: values.direccion.trim(),
})

/** Modal de registro/edición de cliente con vista previa en vivo, según el diseño. */
export function ClientForm({ client, onClose, onSaved }: { client?: Cliente; onClose: () => void; onSaved: (saved: Cliente | null) => void }) {
  const blank: Values = { nombre: client?.nombre ?? '', apellido: client?.apellido ?? '', telefono: client?.telefono ?? '', email: client?.email ?? '', direccion: client?.direccion ?? '' }
  const [values, setValues] = useState<Values>(blank)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [saved, setSaved] = useState<Cliente | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const set = (field: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setGeneralError('')
    const payload = trimmed(values)
    const validationErrors = validate(payload)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) return
    setSaving(true)
    try {
      if (client) {
        const updated = await updateClient(client.id, payload)
        onSaved(updated ?? null)
        return
      }
      const created = await createClient({
        nombre: payload.nombre, apellido: payload.apellido, telefono: payload.telefono,
        ...(payload.email && { email: payload.email }),
        ...(payload.direccion && { direccion: payload.direccion }),
      })
      setSaved(created ?? ({ ...payload, id: 0 } as unknown as Cliente))
      onSaved(created ?? null)
    } catch (cause) {
      const backendErrors = clientFieldErrors(cause)
      if (Object.keys(backendErrors).length) setErrors(backendErrors)
      else setGeneralError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const preview = trimmed(values)
  const fullName = `${preview.nombre} ${preview.apellido}`.trim()
  const required = [Boolean(preview.nombre), Boolean(preview.apellido), Boolean(preview.telefono)].filter(Boolean).length
  const fieldClass = (field: keyof Values) => `ad-mi${errors[field] ? ' bad' : preview[field] && !validate(preview)[field] ? ' good' : ''}`
  const title = client ? 'Editar cliente' : 'Registrar cliente'

  return <>
    <div className="ad-ov" onClick={() => { if (!saving) onClose() }} />
    <div className="ad-mdl" role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
      <div className="ad-prev">
        <span className="ad-bub" aria-hidden="true" style={{ left: '20%', bottom: -30, width: 22, height: 22 }} />
        <span className="ad-bub" aria-hidden="true" style={{ left: '60%', bottom: -30, width: 14, height: 14, animationDelay: '3s' }} />
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.16em', color: '#5BC3EC' }}>VISTA PREVIA</p>
        <div className="ad-pcard" aria-hidden="true">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ad-disp" style={{ fontSize: 18, fontWeight: 800 }}>Se<span style={{ color: '#06709F' }}>Lava</span></span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.16em', color: '#5A7280' }}>CLIENTE</span>
          </div>
          <span className="ad-pav">{fullName ? initials(fullName) : '?'}</span>
          <p className="ad-disp" style={{ margin: '14px 0 2px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName || 'Nombre del cliente'}</p>
          <p style={{ margin: 0, fontSize: 14, color: '#3E5866', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.email || 'correo@ejemplo.com'}</p>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px dashed #DCE7EC', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: '#5A7280' }}>Teléfono</span><strong>{preview.telefono ? `+502 ${preview.telefono}` : '—'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: '#5A7280' }}>Dirección</span><strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{preview.direccion || '—'}</strong></div>
          </div>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}><span style={{ color: '#A9C1CD' }}>Campos obligatorios</span><strong>{required} de 3</strong></div>
          <div style={{ height: 8, borderRadius: 8, background: '#1C4458', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((required / 3) * 100)}%`, background: '#FFC93C', borderRadius: 8, transition: 'width .5s cubic-bezier(.6,0,.2,1)' }} /></div>
        </div>
      </div>

      <div className="ad-frm">
        {saved && !client ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 0' }}>
            <h2 id="client-modal-title" className="ad-sr">{title}</h2>
            <div className="ad-pop" style={{ width: 96, height: 96, borderRadius: '50%', background: '#FFC93C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2433' }}><CheckIcon className="ad-chk" size={44} /></div>
            <p className="ad-disp ad-st" style={{ animationDelay: '.15s', margin: '24px 0 8px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>¡Cliente registrado!</p>
            <p className="ad-st" style={{ animationDelay: '.22s', margin: '0 0 28px', color: '#3E5866', fontSize: 16 }}>{`${saved.nombre} ${saved.apellido}`.trim()} ya aparece en tu lista de clientes.</p>
            <div className="ad-st" style={{ animationDelay: '.3s', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="ad-cancel" type="button" onClick={() => { setSaved(null); setValues({ nombre: '', apellido: '', telefono: '', email: '', direccion: '' }); setErrors({}) }}>Registrar otro</button>
              <button className="ad-savec" type="button" onClick={onClose}>Listo</button>
            </div>
          </div>
        ) : (
          <form aria-label="Formulario de cliente" onSubmit={submit} noValidate>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#06709F' }}>{client ? `Cliente #${client.id}` : 'Nuevo cliente'}</p>
                <h2 id="client-modal-title" className="ad-disp" style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h2>
              </div>
              <button className="ad-x" type="button" onClick={onClose} aria-label="Cerrar" disabled={saving}><CloseIcon size={20} strokeWidth={2.2} /></button>
            </div>

            <div className="ad-mg">
              <div className="ad-mr"><label className="ad-ml" htmlFor="m-nom">Nombre <b>*</b></label><input className={fieldClass('nombre')} id="m-nom" name="nombre" value={values.nombre} maxLength={100} placeholder="María" aria-invalid={Boolean(errors.nombre)} onChange={(event) => set('nombre', event.target.value)} />{errors.nombre && <span className="ad-fe">{errors.nombre}</span>}</div>
              <div className="ad-mr"><label className="ad-ml" htmlFor="m-ape">Apellido <b>*</b></label><input className={fieldClass('apellido')} id="m-ape" name="apellido" value={values.apellido} maxLength={100} placeholder="López" aria-invalid={Boolean(errors.apellido)} onChange={(event) => set('apellido', event.target.value)} />{errors.apellido && <span className="ad-fe">{errors.apellido}</span>}</div>
              <div className="ad-mr"><label className="ad-ml" htmlFor="m-tel">Teléfono <b>*</b></label>
                <div className="ad-pfx"><span aria-hidden="true">+502</span><input className={fieldClass('telefono')} id="m-tel" name="telefono" type="tel" inputMode="tel" value={values.telefono} maxLength={20} placeholder="5512-3456" aria-invalid={Boolean(errors.telefono)} onChange={(event) => set('telefono', event.target.value)} /></div>
                {errors.telefono && <span className="ad-fe">{errors.telefono}</span>}</div>
              <div className="ad-mr"><label className="ad-ml" htmlFor="m-nit">NIT</label><input className="ad-mi" id="m-nit" name="nit" placeholder="Ej. 5487963-2" defaultValue={client?.nit} disabled title="El backend actual todavía no admite NIT" /><span className="ad-hint"><InfoIcon size={14} />Pendiente de soporte en API.</span></div>
              <div className="ad-mr ad-span2"><label className="ad-ml" htmlFor="m-mail">Correo electrónico</label><input className={fieldClass('email')} id="m-mail" name="email" type="email" value={values.email} maxLength={150} placeholder="correo@gmail.com" aria-invalid={Boolean(errors.email)} onChange={(event) => set('email', event.target.value)} />{errors.email && <span className="ad-fe">{errors.email}</span>}</div>
              <div className="ad-mr ad-span2"><label className="ad-ml" htmlFor="m-dir">Dirección</label><input className={fieldClass('direccion')} id="m-dir" name="direccion" value={values.direccion} maxLength={255} placeholder="Zona 10, Ciudad de Guatemala" aria-invalid={Boolean(errors.direccion)} onChange={(event) => set('direccion', event.target.value)} />{errors.direccion && <span className="ad-fe">{errors.direccion}</span>}</div>
            </div>

            {generalError && <p className="ad-perr" role="alert" style={{ marginTop: 18 }}>{generalError}</p>}

            <div className="ad-mact">
              <button className="ad-cancel" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="ad-savec" type="submit" disabled={saving}>
                {saving ? <SpinnerIcon className="ad-spin" size={18} /> : <CheckIcon size={18} strokeWidth={2.2} />}
                {saving ? 'Guardando…' : client ? 'Guardar cambios' : 'Guardar cliente'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  </>
}
