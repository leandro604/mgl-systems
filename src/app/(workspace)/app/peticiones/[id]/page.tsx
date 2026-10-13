import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getMaterialRequestDetail } from '@/features/material-requests/server'
import { RequestDetail } from '@/features/material-requests/ui'

export const dynamic = 'force-dynamic'

export default async function MaterialRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getMaterialRequestDetail(id)
  return <div className="mx-auto max-w-6xl space-y-8"><Link href="/app/peticiones" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"><ArrowLeft className="size-4"/>Peticiones</Link><RequestDetail request={data.request} items={data.items} materials={data.materials} profiles={data.profiles} commitments={data.commitments} canApprove={data.request.approver_id===data.profile.user_id} canDeliver={['admin','pm','supervisor'].includes(data.profile.role)}/></div>
}
