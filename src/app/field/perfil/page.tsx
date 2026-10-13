import { requireWorkspaceContext } from '@/features/auth/server'
import { FieldProfileForm } from '@/features/field/profile-form'

export const dynamic='force-dynamic'
export default async function FieldProfilePage(){const {supabase,company,profile}=await requireWorkspaceContext();const {data,error}=await (supabase as any).from('profiles').select('full_name,dni,phone,position,emergency_contact_name,emergency_contact_phone,emergency_contact_relation').eq('company_id',company.id).eq('user_id',profile.user_id).is('deleted_at',null).single();if(error)throw error;return <div className="space-y-8"><h1 className="text-2xl font-semibold tracking-tight">Perfil</h1><FieldProfileForm companyId={company.id} userId={profile.user_id} initial={data}/></div>}
