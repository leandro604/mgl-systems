import Link from 'next/link'
import { ArrowLeft, CreditCard, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SubscriptionManager } from '@/features/billing/subscription-manager'
import { getSubscriptionDashboard } from '@/features/billing/server'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await getSubscriptionDashboard()
  if (!data.allowed) return <Card><CardHeader><CardTitle>Suscripción</CardTitle></CardHeader></Card>

  return <div className="mx-auto max-w-6xl space-y-8">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3"><CreditCard className="size-6 text-blue-600" /><h1 className="text-2xl font-semibold tracking-tight">Suscripción</h1></div>
      <Button asChild variant="secondary"><Link href="/app/configuracion"><ArrowLeft className="size-4" />Volver</Link></Button>
    </div>
    {data.schemaPending ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert className="mr-2 inline size-4" />Aplica <code>20261010211500_task16_culqi_subscriptions.sql</code>.</div> : null}
    {!data.culqiConfigured ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert className="mr-2 inline size-4" />Configura las llaves de Culqi.</div> : null}
    {!data.schemaPending ? <SubscriptionManager
      plans={data.plans}
      subscription={data.subscription}
      payments={data.payments}
      publicKey={data.publicKey}
      culqiConfigured={data.culqiConfigured}
      defaultEmail={data.email}
      defaultFullName={data.profile.full_name}
    /> : null}
  </div>
}
