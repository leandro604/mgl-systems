import { redirect } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'
import { isFieldWorkerRole } from '@/features/auth/roles'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const { profile } = await requireWorkspaceContext()
  redirect(isFieldWorkerRole(profile.role) ? '/field/notificaciones' : '/app/notificaciones')
}
