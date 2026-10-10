import type { BrowserSupabaseClient } from '@/lib/supabase/client'
import type { VerifiedIdentity } from '@/types/domain'

export async function resolveVerifiedIdentity(client: BrowserSupabaseClient): Promise<VerifiedIdentity | null> {
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) return null

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('company_id,user_id,role,full_name,deleted_at')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile || profile.user_id !== userData.user.id) return null

  return {
    companyId: profile.company_id,
    userId: profile.user_id,
    role: profile.role,
    fullName: profile.full_name,
    verifiedAt: new Date().toISOString(),
  }
}
