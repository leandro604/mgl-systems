import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  cancelCulqiSubscription,
  createCulqiCard,
  createCulqiCustomer,
  createCulqiPlan,
  createCulqiSubscription,
  culqiStatusToSubscriptionStatus,
  CulqiApiError,
  unixToIso,
} from '@/features/billing/culqi'
import { billingAdminClient, getBillingApiContext } from '@/features/billing/server'

const bodySchema = z.object({
  planId: z.string().uuid(),
  tokenId: z.string().trim().min(10).max(80),
  idempotencyKey: z.string().uuid(),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(50),
  phone: z.string().trim().min(5).max(20),
  address: z.string().trim().min(5).max(100),
  city: z.string().trim().min(2).max(30),
  acceptedTerms: z.literal(true),
})

function cleanName(value: string) {
  return value.normalize('NFC').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 50)
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 15)
}

function providerEnvironment() {
  const secret = process.env.CULQI_SECRET_KEY ?? ''
  return secret.startsWith('sk_live_') ? 'live' : secret.startsWith('sk_test_') ? 'test' : null
}

function tokenMatchesEnvironment(tokenId: string) {
  const environment = providerEnvironment()
  return environment ? tokenId.startsWith(`tkn_${environment}_`) : false
}

function providerPlanMatchesEnvironment(providerPlanId: string | null) {
  if (!providerPlanId) return false
  const environment = providerEnvironment()
  return environment ? providerPlanId.startsWith(`pln_${environment}_`) : false
}

export async function POST(request: Request) {
  const actor = await getBillingApiContext()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', message: parsed.error.issues[0]?.message }, { status: 400 })
  if (!process.env.CULQI_SECRET_KEY || !process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY) {
    return NextResponse.json({ error: 'culqi_not_configured' }, { status: 503 })
  }

  if (!tokenMatchesEnvironment(parsed.data.tokenId)) {
    return NextResponse.json({ error: 'culqi_environment_mismatch', message: 'Las llaves pública y privada de Culqi deben pertenecer al mismo entorno.' }, { status: 400 })
  }

  const firstName = cleanName(parsed.data.firstName)
  const lastName = cleanName(parsed.data.lastName)
  const phone = cleanPhone(parsed.data.phone)
  if (firstName.length < 2 || lastName.length < 2 || phone.length < 5) {
    return NextResponse.json({ error: 'invalid_customer' }, { status: 400 })
  }

  const admin = billingAdminClient()
  const { data: existingAttempt, error: attemptError } = await admin
    .from('company_subscriptions')
    .select('id,status,provider_subscription_id')
    .eq('company_id', actor.profile.company_id)
    .eq('idempotency_key', parsed.data.idempotencyKey)
    .maybeSingle()
  if (attemptError) return NextResponse.json({ error: 'billing_lookup_failed' }, { status: 500 })
  if (existingAttempt?.provider_subscription_id) {
    return NextResponse.json({ ok: true, subscriptionId: existingAttempt.id, status: existingAttempt.status })
  }

  const { data: liveSubscription, error: liveError } = await admin
    .from('company_subscriptions')
    .select('id,status')
    .eq('company_id', actor.profile.company_id)
    .in('status', ['pending', 'trialing', 'active', 'past_due'])
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (liveError) return NextResponse.json({ error: 'billing_lookup_failed' }, { status: 500 })
  if (liveSubscription && liveSubscription.id !== existingAttempt?.id) {
    return NextResponse.json({ error: 'active_subscription_exists', message: 'Cancela la suscripción actual antes de cambiar de plan.' }, { status: 409 })
  }

  const { data: plan, error: planError } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('id', parsed.data.planId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (planError || !plan) return NextResponse.json({ error: 'plan_not_found' }, { status: 404 })

  const localSubscriptionId = existingAttempt?.id ?? crypto.randomUUID()
  if (!existingAttempt) {
    const { error: insertError } = await admin.from('company_subscriptions').insert({
      id: localSubscriptionId,
      company_id: actor.profile.company_id,
      plan_id: plan.id,
      status: 'pending',
      billing_contact_name: `${firstName} ${lastName}`,
      billing_email: parsed.data.email.toLowerCase(),
      billing_phone: phone,
      billing_address: parsed.data.address,
      billing_city: parsed.data.city,
      idempotency_key: parsed.data.idempotencyKey,
      created_by: actor.userId,
    })
    if (insertError) {
      if (insertError.code === '23505') return NextResponse.json({ error: 'active_subscription_exists' }, { status: 409 })
      return NextResponse.json({ error: 'subscription_create_failed' }, { status: 500 })
    }
  }

  let createdRemoteSubscriptionId: string | null = null
  try {
    let providerPlanId = plan.provider_plan_id
    if (!providerPlanMatchesEnvironment(providerPlanId)) {
      const remotePlan = await createCulqiPlan({
        name: plan.name,
        code: plan.code,
        interval: plan.billing_interval === 'year' ? 'year' : 'month',
        amountCents: plan.price_cents,
        currency: plan.currency === 'USD' ? 'USD' : 'PEN',
      })
      providerPlanId = remotePlan.id
      const { error: planUpdateError } = await admin
        .from('subscription_plans')
        .update({ provider_plan_id: providerPlanId, updated_at: new Date().toISOString() })
        .eq('id', plan.id)
      if (planUpdateError) throw planUpdateError
    }

    if (!providerPlanId) throw new Error('Culqi no devolvió un plan válido.')

    const { data: previous } = await admin
      .from('company_subscriptions')
      .select('provider_customer_id')
      .eq('company_id', actor.profile.company_id)
      .not('provider_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customerId = previous?.provider_customer_id ?? null
    if (!customerId) {
      const customer = await createCulqiCustomer({
        firstName,
        lastName,
        email: parsed.data.email.toLowerCase(),
        phone,
        address: parsed.data.address,
        city: parsed.data.city,
        companyId: actor.profile.company_id,
      })
      customerId = customer.id
    }

    const card = await createCulqiCard({ customerId, tokenId: parsed.data.tokenId, companyId: actor.profile.company_id })
    if (!card.id) throw new Error('Culqi no devolvió una tarjeta válida.')

    const remoteSubscription = await createCulqiSubscription({
      cardId: card.id,
      planId: providerPlanId,
      companyId: actor.profile.company_id,
      localSubscriptionId,
      planCode: plan.code,
    })
    if (!remoteSubscription.id) throw new Error('Culqi no devolvió una suscripción válida.')
    createdRemoteSubscriptionId = remoteSubscription.id

    const status = culqiStatusToSubscriptionStatus(remoteSubscription.status)
    const lastFour = card.source?.last_four?.match(/^\d{4}$/) ? card.source.last_four : null
    const brand = typeof card.source?.iin?.card_brand === 'string' ? card.source.iin.card_brand : null
    const { error: updateError } = await admin.from('company_subscriptions').update({
      provider_customer_id: customerId,
      provider_card_id: card.id,
      provider_subscription_id: remoteSubscription.id,
      provider_status: typeof remoteSubscription.status === 'number' ? remoteSubscription.status : null,
      status,
      card_brand: brand,
      card_last_four: lastFour,
      next_billing_at: unixToIso(remoteSubscription.next_billing_date),
      updated_at: new Date().toISOString(),
    }).eq('id', localSubscriptionId)
    if (updateError) throw updateError

    return NextResponse.json({ ok: true, subscriptionId: localSubscriptionId, status })
  } catch (error) {
    if (createdRemoteSubscriptionId) await cancelCulqiSubscription(createdRemoteSubscriptionId).catch(() => undefined)
    await admin.from('company_subscriptions').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', localSubscriptionId)
    const message = error instanceof CulqiApiError || error instanceof Error ? error.message : 'No se pudo crear la suscripción.'
    return NextResponse.json({ error: 'culqi_subscription_failed', message }, { status: error instanceof CulqiApiError ? 422 : 500 })
  }
}
