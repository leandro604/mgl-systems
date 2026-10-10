import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectTeamManager } from '@/features/projects/project-team-manager'
import { getProjectPeople } from '@/features/projects/server'

export default async function ProjectTeamPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { memberships, availableProfiles, profile, userId } = await getProjectPeople(projectId)
  const canManage = profile.role === 'admin' || profile.role === 'pm'
  return <Card><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Equipo del proyecto</CardTitle><CardDescription>{canManage ? 'Asigna perfiles existentes de tu empresa o invita una persona nueva.' : 'Miembros con acceso activo a este proyecto.'}</CardDescription></div>{profile.role === 'admin' ? <Button asChild size="sm"><Link href={`/app/team?project=${projectId}`}><UserPlus />Invitar usuario</Link></Button> : null}</CardHeader><CardContent><ProjectTeamManager projectId={projectId} currentUserId={userId} members={memberships} availableProfiles={availableProfiles} canManage={canManage} /></CardContent></Card>
}
