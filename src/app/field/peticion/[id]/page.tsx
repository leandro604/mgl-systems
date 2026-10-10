import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FieldRequestDetail } from '@/features/material-requests/ui'
import { getMaterialRequestReferenceData } from '@/features/material-requests/server'

export const dynamic = 'force-dynamic'

export default async function FieldRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, data] = await Promise.all([params, getMaterialRequestReferenceData()])
  return <div className="space-y-4"><Link href="/field/mis-peticiones" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft className="size-4"/>Peticiones</Link><FieldRequestDetail companyId={data.company.id} userId={data.profile.user_id} requestId={id} materials={data.materials}/></div>
}
