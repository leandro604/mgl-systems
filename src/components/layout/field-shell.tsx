'use client'

import type { ReactNode } from 'react'
import { FieldBottomNav } from './field-bottom-nav'
import { FieldSidebar } from './field-sidebar'
import { useNotifications } from '@/features/notifications/use-notifications'

export function FieldShell({ companyId, userId, companyName, fullName, children }: { companyId: string; userId: string; companyName: string; fullName: string; children: ReactNode }) {
  const notifications = useNotifications(companyId, userId)
  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-950 md:pb-0">
      <FieldSidebar companyName={companyName} fullName={fullName} unreadCount={notifications.unreadCount} />
      <main className="mx-auto max-w-lg px-4 py-5 md:ml-60 md:max-w-none md:px-8 md:py-8">{children}</main>
      <FieldBottomNav unreadCount={notifications.unreadCount}/>
    </div>
  )
}
