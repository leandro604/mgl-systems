import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MyRequestsClient } from '@/features/material-requests/ui'
import { requireWorkspaceContext } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function MyFieldRequestsPage() {
  const { company, profile, projects } = await requireWorkspaceContext()
  return <div className="space-y-5"><div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight">Mis peticiones</h1><Button asChild size="sm"><Link href="/field/peticion/nueva"><Plus/>Nueva</Link></Button></div><MyRequestsClient companyId={company.id} userId={profile.user_id} projects={projects.map(({id,code,name})=>({id,code,name}))}/></div>
}
