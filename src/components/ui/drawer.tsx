'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
      className={cn(
        'mgl-drawer fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-[480px] overflow-y-auto border-l border-slate-200 bg-white p-0 text-slate-950 shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm',
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
          <X />
        </Button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}
