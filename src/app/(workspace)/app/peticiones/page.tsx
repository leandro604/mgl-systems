import { RequestList } from '@/features/material-requests/ui'
import { listMaterialRequests } from '@/features/material-requests/server'

export const dynamic = 'force-dynamic'

export default async function MaterialRequestsPage() {
  const data = await listMaterialRequests()
  return <div className="mx-auto max-w-7xl space-y-8"><div className="flex items-center justify-between"><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Peticiones</h1></div><RequestList requests={data.requests} items={data.items} profiles={data.profiles} projects={data.projects.map(({id,code,name})=>({id,code,name}))}/></div>
}
