'use client'

import { useCallback, useState } from 'react'
import { NotificationBell } from '@/components/layout/notification-bell'
import { NotificationDrawer } from './notification-drawer'
import { useNotifications } from './use-notifications'

export function NotificationCenterButton({ companyId, userId }: { companyId: string; userId: string }) {
  const [open, setOpen] = useState(false)
  const model = useNotifications(companyId, userId)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <NotificationBell unreadCount={model.unreadCount} onClick={() => setOpen(true)} />
      <NotificationDrawer open={open} onClose={close} model={model} />
    </>
  )
}
