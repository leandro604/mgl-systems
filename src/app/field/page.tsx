import { redirect } from 'next/navigation'
import { requireFieldWorkspaceContext } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function FieldIndexPage() {
  await requireFieldWorkspaceContext()
  redirect('/field/hoy')
}
