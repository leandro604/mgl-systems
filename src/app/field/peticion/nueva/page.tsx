import { NewRequestWizard } from '@/features/material-requests/ui'
import { getMaterialRequestReferenceData } from '@/features/material-requests/server'

export const dynamic = 'force-dynamic'

export default async function NewFieldRequestPage() {
  const data = await getMaterialRequestReferenceData()
  return <div className="space-y-5"><h1 className="text-2xl font-semibold tracking-tight">Nueva petición</h1><NewRequestWizard companyId={data.company.id} userId={data.profile.user_id} projects={data.projects.map(({id,code,name})=>({id,code,name}))} materials={data.materials} stages={data.stages} budgets={data.budgets} approversByProject={data.approversByProject}/></div>
}
