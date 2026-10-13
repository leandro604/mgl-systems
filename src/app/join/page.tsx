import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InvitationAcceptance } from '@/features/team/invitation-acceptance'
import { getMyWorkspaceInvitation } from '@/features/team/server'

export const dynamic = 'force-dynamic'

export default async function JoinWorkspacePage({ searchParams }: { searchParams: Promise<{ invitation?: string | string[] | undefined }> }) {
  const query = await searchParams
  const invitationId = typeof query.invitation === 'string' ? query.invitation : undefined
  if (!invitationId) redirect('/')

  const { supabase, userId, invitation } = await getMyWorkspaceInvitation(invitationId)
  const { data: profile, error } = await supabase.from('profiles').select('full_name').eq('user_id', userId).is('deleted_at', null).maybeSingle()
  if (error) throw error

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <div className="mt-12"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Invitación</span><h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Únete al equipo</h1></div>
        <Card className="mt-8 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          {invitation ? <InvitationAcceptance invitation={invitation} initialFullName={profile?.full_name ?? ''} /> : <div className="text-center"><h2 className="text-lg font-medium tracking-tight text-white">Invitación no disponible</h2><p className="mt-3 text-sm text-slate-400">Puede haber vencido, haber sido revocada o pertenecer a otro correo.</p><Button asChild className="mt-6"><Link href="/">Continuar</Link></Button></div>}
        </Card>
      </div>
    </main>
  )
}
