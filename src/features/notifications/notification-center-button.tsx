'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { NotificationBell } from '@/components/layout/notification-bell'
import { NotificationDrawer } from './notification-drawer'
import { useNotifications } from './use-notifications'

export function NotificationCenterButton({ companyId, userId }: { companyId: string; userId: string }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const model = useNotifications(companyId, userId)
  const close = useCallback(() => {
    setOpen(false)
    anchorRef.current?.focus()
  }, [])

  return (
    <>
      <NotificationBell buttonRef={anchorRef} expanded={open} controls={open ? panelId : undefined} unreadCount={model.unreadCount} onClick={() => {
        if (open) close()
        else {
          setOpen(true)
          if (model.online) void model.refresh()
        }
      }} />
      {open ? <NotificationDrawer panelId={panelId} anchorRef={anchorRef} onClose={close} model={model} /> : null}
    </>
  )
}
