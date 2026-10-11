import Link from 'next/link'
import { Check } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { fallbackSubscriptionPlans } from '@/features/billing/catalog'
import { isBillingSchemaUnavailable, mapPlan } from '@/features/billing/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function money(cents: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(cents / 100)
}

export default async function PlansPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('subscription_plans').select('*').eq('active', true).is('deleted_at', null).order('price_cents')
  const plans = error && !isBillingSchemaUnavailable(error) ? fallbackSubscriptionPlans : (data?.length ? data.map(mapPlan) : fallbackSubscriptionPlans)
  const monthly = plans.filter((plan) => plan.billingInterval === 'month')

  return <main className="min-h-screen bg-[#FAFAFA] px-5 py-8 text-slate-950">
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4"><Logo /><Button asChild variant="secondary"><Link href="/login">Ingresar</Link></Button></div>
      <div className="mt-16 text-center"><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Planes MGL Systems</h1></div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {monthly.map((plan) => <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{plan.name}</h2>
          <p className="mt-4 text-3xl font-semibold">{money(plan.priceCents)}<span className="text-sm font-normal text-slate-500"> / mes</span></p>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            <p className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{plan.maxProjects === null ? 'Proyectos ilimitados' : `${plan.maxProjects} proyectos`}</p>
            <p className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{plan.maxUsers ?? '∞'} usuarios</p>
          </div>
          <Button asChild className="mt-6 w-full"><Link href="/register">Empezar</Link></Button>
        </div>)}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">Planes anuales disponibles desde la configuración de la empresa.</p>
    </div>
  </main>
}
