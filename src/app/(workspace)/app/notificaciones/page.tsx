import { requireWorkspaceContext } from '@/features/auth/server'
import { NotificationsPageClient } from '@/features/notifications/notifications-page-client'
export const dynamic='force-dynamic'
export default async function NotificationsAppPage(){const {company,profile}=await requireWorkspaceContext();return <NotificationsPageClient companyId={company.id} userId={profile.user_id}/>}
