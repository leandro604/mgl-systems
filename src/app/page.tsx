import { redirect } from 'next/navigation'
import { getVerifiedSubject } from '@/features/auth/server'
import { parseMyWorkspaceInvitation } from '@/features/team/parsers'
import { homeForRole } from '@/features/auth/roles'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { supabase, userId } = await getVerifiedSubject()
  if (!userId) redirect('/login')

  const [profileResult, invitationResult] = await Promise.all([
    supabase.from('profiles').select('id,company_id,role').eq('user_id', userId).is('deleted_at', null).maybeSingle(),
    supabase.rpc('get_my_workspace_invitation', { p_invitation_id: null }),
  ])
  if (profileResult.error) throw profileResult.error
  if (invitationResult.error) throw invitationResult.error

  const profile = profileResult.data
  const invitation = parseMyWorkspaceInvitation(invitationResult.data)
  if (invitation && (!profile || (profile.company_id !== invitation.company_id && invitation.can_transfer))) {
    redirect(`/join?invitation=${invitation.id}`)
  }
  redirect(profile ? homeForRole(profile.role) : '/onboarding')
}
