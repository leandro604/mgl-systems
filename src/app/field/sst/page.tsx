import { FieldSstForm } from '@/features/field/field-ui'
import { requireWorkspaceContext } from '@/features/auth/server'

export const dynamic='force-dynamic'
export default async function FieldSstPage(){const {company,profile,projects}=await requireWorkspaceContext();return <div className="space-y-5"><h1 className="text-2xl font-semibold tracking-tight">SST</h1><FieldSstForm companyId={company.id} userId={profile.user_id} projects={projects.map(({id,name})=>({id,name}))}/></div>}
