import { useEffect, useState } from 'react'

export type Toast = {
  id: string
  title: string
  body: string
}

export function ToastHost(props: { toasts: Toast[] }) {
  const { toasts } = props
  const [visible, setVisible] = useState<Toast[]>([])

  useEffect(() => {
    setVisible(toasts.slice(-3))
  }, [toasts])

  return (
    <div className="toastWrap" aria-live="polite" aria-atomic="true">
      {visible.map((t) => (
        <div key={t.id} className="toast">
          <div className="toastTitle">{t.title}</div>
          <div className="toastBody">{t.body}</div>
        </div>
      ))}
    </div>
  )
}

