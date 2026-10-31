import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertIcon, CheckIcon } from '../components/admin/icons'

/** Aviso flotante del diseño; se oculta solo. */
export function useToast(duration = 2600) {
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const show = useCallback((text: string, error = false) => {
    setToast({ text, error })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), duration)
  }, [duration])
  const node = toast ? <div className={`ad-toast${toast.error ? ' err' : ''}`} role={toast.error ? 'alert' : 'status'}><span>{toast.error ? <AlertIcon size={18} /> : <CheckIcon size={18} strokeWidth={3} />}</span>{toast.text}</div> : null
  return { show, node }
}

