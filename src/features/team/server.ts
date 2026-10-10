import { requireAuthenticatedUser } from '@/features/auth/server'
import { parseMyWorkspaceInvitation } from './parsers'

export async function getMyWorkspaceInvitation(invitationId?: string) {
  const { supabase, userId } = await requireAuthenticatedUser()
  const { data, error } = await supabase.rpc('get_my_workspace_invitation', {
    p_invitation_id: invitationId ?? null,
  })
  if (error) throw error
  return { supabase, userId, invitation: parseMyWorkspaceInvitation(data) }
}
