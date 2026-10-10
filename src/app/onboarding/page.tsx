import { redirect } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { Card } from '@/components/ui/card'
import { OnboardingForm } from '@/features/auth/onboarding-form'
import { requireAuthenticatedUser } from '@/features/auth/server'
import { InvitationAcceptance } from '@/features/team/invitation-acceptance'
import { parseMyWorkspaceInvitation } from '@/features/team/parsers'
import { homeForRole } from '@/features/auth/roles'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const { supabase, userId } = await requireAuthenticatedUser()
  const [profileResult, invitationResult] = await Promise.all([
    supabase.from('profiles').select('id,full_name,role').eq('user_id', userId).is('deleted_at', null).maybeSingle(),
    supabase.rpc('get_my_workspace_invitation', { p_invitation_id: null }),
  ])
  if (profileResult.error) throw profileResult.error
  if (invitationResult.error) throw invitationResult.error
  if (profileResult.data) redirect(homeForRole(profileResult.data.role))

  const invitation = parseMyWorkspaceInvitation(invitationResult.data)
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <div className="mt-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Configuración inicial</span>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">{invitation ? 'Tienes una invitación pendiente' : 'Configura tu empresa'}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">{invitation ? `Puedes unirte a ${invitation.company_name} sin crear un workspace separado.` : 'Crea un workspace solo si eres la persona que administrará una empresa nueva. Los demás usuarios deben entrar mediante una invitación.'}</p>
        </div>
        <Card className="mt-8 border-slate-800 bg-slate-900/70 p-6 sm:p-8">{invitation ? <InvitationAcceptance invitation={invitation} /> : <OnboardingForm />}</Card>
      </div>
    </main>
  )
}
