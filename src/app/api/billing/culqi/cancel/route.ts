import { NextResponse } from 'next/server'
import { cancelCulqiSubscription, CulqiApiError } from '@/features/billing/culqi'
import { billingAdminClient, getBillingApiContext } from '@/features/billing/server'

export async function POST() {
  const actor = await getBillingApiContext()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = billingAdminClient()
  const { data: subscription, error } = await admin
    .from('company_subscriptions')
    .select('id,provider_subscription_id,status')
    .eq('company_id', actor.profile.company_id)
    .in('status', ['pending', 'trialing', 'active', 'past_due'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'billing_lookup_failed' }, { status: 500 })
  if (!subscription) return NextResponse.json({ error: 'subscription_not_found' }, { status: 404 })

  try {
    if (subscription.provider_subscription_id) await cancelCulqiSubscription(subscription.provider_subscription_id)
    const now = new Date().toISOString()
    const { error: updateError } = await admin.from('company_subscriptions').update({
      status: 'canceled',
      canceled_at: now,
      cancel_reason: 'customer_request',
      updated_at: now,
    }).eq('id', subscription.id)
    if (updateError) throw updateError
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof CulqiApiError || error instanceof Error ? error.message : 'No se pudo cancelar la suscripción.'
    return NextResponse.json({ error: 'cancel_failed', message }, { status: error instanceof CulqiApiError ? 422 : 500 })
  }
}
