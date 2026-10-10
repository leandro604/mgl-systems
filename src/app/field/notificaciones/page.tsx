import { NotificationsPageClient } from '@/features/notifications/notifications-page-client'
import { requireWorkspaceContext } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function FieldNotificationsPage() {
  const { company, profile } = await requireWorkspaceContext()
  return <NotificationsPageClient companyId={company.id} userId={profile.user_id} field />
}
