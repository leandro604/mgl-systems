import type { ReactNode } from 'react'
import { FieldShell } from '@/components/layout/field-shell'
import { requireFieldWorkspaceContext } from '@/features/auth/server'
import { FieldHeader } from '@/components/layout/field-header'

export const dynamic = 'force-dynamic'

export default async function FieldLayout({ children }: { children: ReactNode }) {
  const { company, profile } = await requireFieldWorkspaceContext()
  return <div><FieldHeader fullName={profile.full_name} /><FieldShell companyId={company.id} userId={profile.user_id} companyName={company.legal_name} fullName={profile.full_name}>{children}</FieldShell></div>
}
