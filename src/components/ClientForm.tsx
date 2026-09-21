import { useState, type FormEvent } from 'react'
import { clientFieldErrors, createClient } from '../api/clients'
import { errorMessage } from '../api/client'
import type { ClienteCreate } from '../types'

type FieldErrors = Partial<Record<keyof ClienteCreate, string>>

const namePattern = /^[\p{L}\s'-]+$/u
const phonePattern = /^\+?[0-9\s-]{8,15}$/
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function validate(payload: ClienteCreate): FieldErrors {
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

export function ClientForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setGeneralError('')
    const values = new FormData(event.currentTarget)
    const payload: ClienteCreate = {
      nombre: String(values.get('nombre') ?? '').trim(),
      apellido: String(values.get('apellido') ?? '').trim(),
      telefono: String(values.get('telefono') ?? '').trim(),
      ...(String(values.get('email') ?? '').trim() && { email: String(values.get('email')).trim() }),
      ...(String(values.get('direccion') ?? '').trim() && { direccion: String(values.get('direccion')).trim() }),
    }
    const validationErrors = validate(payload)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) return

    setSaving(true)
    try {
      await createClient(payload)
      onSaved()
    } catch (cause) {
      const backendErrors = clientFieldErrors(cause)
      if (Object.keys(backendErrors).length) setErrors(backendErrors)
      else setGeneralError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return <form className="client-form" aria-label="Formulario de cliente" onSubmit={submit} noValidate>
    <div className="client-form-grid">
      <label>Nombre *<input name="nombre" maxLength={100} placeholder="María" aria-invalid={Boolean(errors.nombre)} />{errors.nombre && <small className="field-error">{errors.nombre}</small>}</label>
      <label>Apellido *<input name="apellido" maxLength={100} placeholder="López" aria-invalid={Boolean(errors.apellido)} />{errors.apellido && <small className="field-error">{errors.apellido}</small>}</label>
      <label>Teléfono *<input name="telefono" maxLength={20} inputMode="tel" placeholder="5512-3456" aria-invalid={Boolean(errors.telefono)} />{errors.telefono && <small className="field-error">{errors.telefono}</small>}</label>
      <label>NIT<input name="nit" placeholder="Ej. 5487963-2" disabled title="El backend actual todavía no admite NIT"/><small className="capability-note">Pendiente de soporte en API.</small></label>
    </div>
    <label>Correo electrónico<input name="email" type="email" maxLength={150} placeholder="correo@gmail.com" aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error">{errors.email}</small>}</label>
    <label>Dirección<input name="direccion" maxLength={255} placeholder="Zona 10, Ciudad de Guatemala" aria-invalid={Boolean(errors.direccion)} />{errors.direccion && <small className="field-error">{errors.direccion}</small>}</label>
    {generalError && <div className="alert error" role="alert">{generalError}</div>}
    <footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cliente'}</button></footer>
  </form>
}
