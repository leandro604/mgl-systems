'use client'

import Script from 'next/script'
import { useMemo, useRef, useState } from 'react'
import { Check, CreditCard, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CompanySubscriptionSummary, SubscriptionPaymentSummary, SubscriptionPlan } from './types'

type CulqiToken = { id?: string }
type CulqiError = { user_message?: string; merchant_message?: string }
type CulqiCheckoutInstance = {
  token?: CulqiToken
  error?: CulqiError
  culqi?: () => void
  open: () => void
  close: () => void
}
type CulqiCheckoutConstructor = new (publicKey: string, config: Record<string, unknown>) => CulqiCheckoutInstance

declare global {
  interface Window {
    CulqiCheckout?: CulqiCheckoutConstructor
  }
}

const featureLabels: Record<string, string> = {
  projects: 'Proyectos',
  tasks: 'Tareas',
  documents: 'Documentos',
  sst: 'SST',
  inventory: 'Almacén',
  planning: 'Planificación',
  control: 'Control',
  purchases: 'Compras',
  finance: 'Finanzas',
  reports: 'Reportes',
  drive: 'Drive / OneDrive',
  sunat: 'SUNAT',
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(cents / 100)
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(value)) : '—'
}

function statusLabel(status: CompanySubscriptionSummary['status']) {
  const labels: Record<CompanySubscriptionSummary['status'], string> = {
    pending: 'Pendiente',
    trialing: 'Prueba',
    active: 'Activa',
    past_due: 'Pago pendiente',
    canceled: 'Cancelada',
    ended: 'Finalizada',
    failed: 'Fallida',
  }
  return labels[status]
}

export function SubscriptionManager({
  plans,
  subscription,
  payments,
  publicKey,
  culqiConfigured,
  defaultEmail,
  defaultFullName,
}: {
  plans: SubscriptionPlan[]
  subscription: CompanySubscriptionSummary | null
  payments: SubscriptionPaymentSummary[]
  publicKey: string
  culqiConfigured: boolean
  defaultEmail: string
  defaultFullName: string
}) {
  const live = subscription && ['pending', 'trialing', 'active', 'past_due'].includes(subscription.status)
  const [interval, setInterval] = useState<'month' | 'year'>(subscription?.billingInterval ?? 'month')
  const visiblePlans = useMemo(() => plans.filter((plan) => plan.billingInterval === interval), [plans, interval])
  const [selectedPlanId, setSelectedPlanId] = useState(subscription?.planId ?? visiblePlans.find((plan) => plan.code === 'pro')?.id ?? visiblePlans[0]?.id ?? '')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const nameParts = defaultFullName.trim().split(/\s+/)
  const defaultFirstName = nameParts[0] ?? ''
  const defaultLastName = nameParts.slice(1).join(' ') || defaultFirstName

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId && plan.billingInterval === interval) ?? visiblePlans[0]

  async function submitToken(tokenId: string, fields: FormData) {
    const response = await fetch('/api/billing/culqi/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedPlan?.id,
        tokenId,
        idempotencyKey: crypto.randomUUID(),
        firstName: fields.get('first_name'),
        lastName: fields.get('last_name'),
        email: fields.get('email'),
        phone: fields.get('phone'),
        address: fields.get('address'),
        city: fields.get('city'),
        acceptedTerms: fields.get('terms') === 'on',
      }),
    })
    const result = await response.json().catch(() => ({})) as { ok?: boolean; message?: string; error?: string }
    if (!response.ok || !result.ok) throw new Error(result.message ?? 'No se pudo activar la suscripción.')
    window.location.reload()
  }

  function startCheckout() {
    const form = formRef.current
    if (!form || !selectedPlan) return
    if (!form.reportValidity()) return
    if (!culqiConfigured || !publicKey) return setMessage('Culqi no está configurado.')
    if (!window.CulqiCheckout) return setMessage('Culqi todavía está cargando.')

    const fields = new FormData(form)
    setMessage('')
    const checkout = new window.CulqiCheckout(publicKey, {
      settings: { title: `MGL Systems · ${selectedPlan.name}`, currency: selectedPlan.currency, amount: 0 },
      client: {
        email: String(fields.get('email') ?? ''),
        firstName: String(fields.get('first_name') ?? ''),
        lastName: String(fields.get('last_name') ?? ''),
      },
      options: {
        lang: 'es',
        installments: false,
        modal: true,
        paymentMethods: { tarjeta: true, yape: false, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
        paymentMethodsSort: ['tarjeta'],
      },
    })

    checkout.culqi = () => {
      if (checkout.token?.id) {
        const token = checkout.token.id
        setPending(true)
        checkout.close()
        void submitToken(token, fields).catch((error: unknown) => {
          setPending(false)
          setMessage(error instanceof Error ? error.message : 'No se pudo activar la suscripción.')
        })
        return
      }
      setPending(false)
      setMessage(checkout.error?.user_message ?? checkout.error?.merchant_message ?? 'No se pudo tokenizar la tarjeta.')
    }
    checkout.open()
  }

  async function cancelSubscription() {
    if (!window.confirm('La cancelación en Culqi es inmediata. ¿Continuar?')) return
    setPending(true)
    setMessage('')
    const response = await fetch('/api/billing/culqi/cancel', { method: 'POST' })
    const result = await response.json().catch(() => ({})) as { ok?: boolean; message?: string }
    if (!response.ok || !result.ok) {
      setPending(false)
      return setMessage(result.message ?? 'No se pudo cancelar la suscripción.')
    }
    window.location.reload()
  }

  return <div className="space-y-8">
    <Script src="https://js.culqi.com/checkout-js" strategy="afterInteractive" />

    {subscription ? <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Plan actual</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{subscription.planName}</p>
          <p className="mt-1 text-sm text-slate-600">{money(subscription.priceCents, subscription.currency)} / {subscription.billingInterval === 'year' ? 'año' : 'mes'}</p>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">{statusLabel(subscription.status)}</span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div><p className="text-xs text-slate-500">Próximo cobro</p><p className="mt-1 text-sm font-medium">{date(subscription.nextBillingAt)}</p></div>
        <div><p className="text-xs text-slate-500">Tarjeta</p><p className="mt-1 text-sm font-medium">{subscription.cardBrand ?? 'Tarjeta'} {subscription.cardLastFour ? `•••• ${subscription.cardLastFour}` : ''}</p></div>
        <div><p className="text-xs text-slate-500">Alta</p><p className="mt-1 text-sm font-medium">{date(subscription.createdAt)}</p></div>
      </div>
      {live ? <div className="mt-5"><Button type="button" variant="destructive" onClick={cancelSubscription} disabled={pending}><XCircle className="size-4" />Cancelar suscripción</Button></div> : null}
    </div> : null}

    {!live ? <>
      <div className="flex gap-2">
        <Button type="button" variant={interval === 'month' ? 'default' : 'secondary'} onClick={() => { setInterval('month'); setSelectedPlanId(plans.find((plan) => plan.billingInterval === 'month' && plan.code === 'pro')?.id ?? '') }}>Mensual</Button>
        <Button type="button" variant={interval === 'year' ? 'default' : 'secondary'} onClick={() => { setInterval('year'); setSelectedPlanId(plans.find((plan) => plan.billingInterval === 'year' && plan.code === 'pro')?.id ?? '') }}>Anual</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {visiblePlans.map((plan) => <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`rounded-xl border bg-white p-6 text-left shadow-sm ${selectedPlan?.id === plan.id ? 'border-blue-600 ring-2 ring-blue-600/10' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium text-slate-700">{plan.name}</h3>{selectedPlan?.id === plan.id ? <Check className="size-5 text-blue-600" /> : null}</div>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-950">{money(plan.priceCents, plan.currency)}</p>
          <p className="text-xs text-slate-500">/{plan.billingInterval === 'year' ? 'año' : 'mes'}</p>
          <div className="mt-4 space-y-1.5 text-sm text-slate-600">
            <p>{plan.maxProjects === null ? 'Proyectos ilimitados' : `${plan.maxProjects} proyectos`}</p>
            <p>{plan.maxUsers === null ? 'Usuarios ilimitados' : `${plan.maxUsers} usuarios`}</p>
            {plan.features.slice(0, 5).map((feature) => <p key={feature} className="flex items-center gap-2"><Check className="size-3.5 text-emerald-600" />{featureLabels[feature] ?? feature}</p>)}
          </div>
        </button>)}
      </div>

      <form ref={formRef} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2"><CreditCard className="size-5 text-blue-600" /><h3 className="text-sm font-medium text-slate-700">Datos de facturación</h3></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="first_name">Nombre</Label><Input id="first_name" name="first_name" defaultValue={defaultFirstName} required minLength={2} maxLength={50} /></div>
          <div className="space-y-2"><Label htmlFor="last_name">Apellido</Label><Input id="last_name" name="last_name" defaultValue={defaultLastName} required minLength={2} maxLength={50} /></div>
          <div className="space-y-2"><Label htmlFor="email">Correo</Label><Input id="email" name="email" type="email" defaultValue={defaultEmail} required maxLength={50} /></div>
          <div className="space-y-2"><Label htmlFor="phone">Teléfono</Label><Input id="phone" name="phone" inputMode="tel" required maxLength={20} /></div>
          <div className="space-y-2"><Label htmlFor="address">Dirección</Label><Input id="address" name="address" required minLength={5} maxLength={100} /></div>
          <div className="space-y-2"><Label htmlFor="city">Ciudad</Label><Input id="city" name="city" defaultValue="Lima" required minLength={2} maxLength={30} /></div>
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-600"><input name="terms" type="checkbox" required className="mt-0.5 size-4 rounded border-slate-300" />Acepto los términos y cobros recurrentes.</label>
        {message ? <p className="mt-4 text-sm text-red-600" role="alert">{message}</p> : null}
        <div className="mt-5"><Button type="button" onClick={startCheckout} disabled={pending || !selectedPlan || !culqiConfigured}>{pending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}Suscribirme</Button></div>
      </form>
    </> : null}

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-700">Pagos</h3>
      {payments.length ? <div className="mgl-table-scroll mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2 pr-4">Fecha</th><th className="py-2 pr-4">Monto</th><th className="py-2 pr-4">Estado</th><th className="py-2">Tarjeta</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-4">{date(payment.paidAt ?? payment.createdAt)}</td><td className="py-3 pr-4">{money(payment.amountCents, payment.currency)}</td><td className="py-3 pr-4">{payment.status === 'paid' ? 'Pagado' : payment.status === 'failed' ? 'Fallido' : payment.status}</td><td className="py-3">{payment.cardBrand ?? 'Tarjeta'} {payment.cardLastFour ? `•••• ${payment.cardLastFour}` : ''}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">Sin pagos</p>}
    </div>
  </div>
}
