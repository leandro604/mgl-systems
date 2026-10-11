import { NextResponse } from 'next/server'
import { asObject, culqiStatusToSubscriptionStatus, getCulqiEvent, unixToIso } from '@/features/billing/culqi'
import { billingAdminClient } from '@/features/billing/server'
import type { Database, Json } from '@/lib/supabase/database.types'

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : null
}

function numberValue(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function subscriptionIdFrom(data: Record<string, unknown>) {
  const direct = stringValue(data.id)
  if (direct?.startsWith('sxn_')) return direct
  const explicit = stringValue(data.subscription_id)
  if (explicit) return explicit
  const subscription = asObject(data.subscription)
  return subscription ? stringValue(subscription.id) : null
}

function latestCharge(data: Record<string, unknown>) {
  const direct = asObject(data.charge)
  if (direct) return direct
  const directId = stringValue(data.id)
  if (directId?.startsWith('chr_')) return data
  const periods = Array.isArray(data.periods) ? data.periods : []
  for (let i = periods.length - 1; i >= 0; i -= 1) {
    const period = asObject(periods[i])
    const charges = period && Array.isArray(period.charges) ? period.charges : []
    if (charges.length) {
      const charge = asObject(charges[charges.length - 1])
      if (charge) return charge
    }
  }
  return null
}

function throwSupabaseError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function eventStatus(type: string, data: Record<string, unknown>) {
  if (type === 'subscription.cancel.succeeded') return 'canceled'
  if (type === 'subscription.creation.failed') return 'failed'
  if (type === 'subscription.charge.failed') return 'past_due'
  if (type === 'subscription.charge.succeeded' || type === 'subscription.trial.end') return 'active'
  return culqiStatusToSubscriptionStatus(data.status)
}

export async function POST(request: Request) {
  if (!process.env.CULQI_SECRET_KEY) return NextResponse.json({ error: 'culqi_not_configured' }, { status: 503 })
  const incoming = asObject(await request.json().catch(() => null))
  const eventId = incoming ? stringValue(incoming.id) : null
  if (!eventId?.startsWith('evt_')) return NextResponse.json({ error: 'invalid_event' }, { status: 400 })

  try {
    // Culqi does not document a portable signature header for every webhook mode.
    // Re-fetching the event with the private API key authenticates the event before applying state.
    const canonical = await getCulqiEvent(eventId)
    const type = stringValue(canonical.type) ?? stringValue(incoming?.type) ?? 'unknown'
    const data = asObject(canonical.data) ?? {}
    const admin = billingAdminClient()

    const { data: previousEvent, error: previousError } = await admin
      .from('billing_events')
      .select('id,processed_at')
      .eq('provider', 'culqi')
      .eq('provider_event_id', eventId)
      .maybeSingle()
    if (previousError) return NextResponse.json({ error: 'event_lookup_failed' }, { status: 500 })
    if (previousEvent?.processed_at) return NextResponse.json({ ok: true, duplicate: true })

    let eventRowId = previousEvent?.id ?? null
    if (!eventRowId) {
      const { data: inserted, error: insertError } = await admin.from('billing_events').insert({
        provider: 'culqi',
        provider_event_id: eventId,
        event_type: type,
        payload: canonical as unknown as Json,
      }).select('id').single()
      if (insertError) {
        if (insertError.code === '23505') return NextResponse.json({ error: 'event_in_progress' }, { status: 409 })
        return NextResponse.json({ error: 'event_store_failed' }, { status: 500 })
      }
      eventRowId = inserted.id
    }

    const metadata = asObject(data.metadata) ?? {}
    const localSubscriptionId = stringValue(metadata.mgl_subscription_id)
    const providerSubscriptionId = subscriptionIdFrom(data)

    let subscription = null as null | {
      id: string
      company_id: string
      card_brand: string | null
      card_last_four: string | null
    }
    if (localSubscriptionId) {
      const result = await admin.from('company_subscriptions').select('id,company_id,card_brand,card_last_four').eq('id', localSubscriptionId).maybeSingle()
      throwSupabaseError(result.error)
      subscription = result.data
    }
    if (!subscription && providerSubscriptionId) {
      const result = await admin.from('company_subscriptions').select('id,company_id,card_brand,card_last_four').eq('provider_subscription_id', providerSubscriptionId).maybeSingle()
      throwSupabaseError(result.error)
      subscription = result.data
    }

    if (subscription) {
      const nextStatus = eventStatus(type, data)
      const nextBillingAt = unixToIso(data.next_billing_date)
      const providerStatus = numberValue(data.status)
      const patch: Database['public']['Tables']['company_subscriptions']['Update'] = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      }
      if (providerStatus !== null) patch.provider_status = providerStatus
      if (nextBillingAt) patch.next_billing_at = nextBillingAt
      if (nextStatus === 'canceled') patch.canceled_at = new Date().toISOString()
      const subscriptionUpdate = await admin.from('company_subscriptions').update(patch).eq('id', subscription.id)
      throwSupabaseError(subscriptionUpdate.error)

      if (type === 'subscription.charge.succeeded' || type === 'subscription.charge.failed') {
        const charge = latestCharge(data) ?? data
        const chargeId = stringValue(charge.charge_id) ?? stringValue(charge.id)
        const amountCents = Math.max(0, numberValue(charge.amount) ?? 0)
        const currency = stringValue(charge.currency) ?? stringValue(charge.currency_code) ?? 'PEN'
        const brand = stringValue(charge.card_brand) ?? subscription.card_brand
        const rawCard = stringValue(charge.card_number)
        const lastFourMatch = rawCard?.match(/(\d{4})$/)
        const lastFour = lastFourMatch?.[1] ?? subscription.card_last_four
        const failureMessage = type.endsWith('.failed') ? (stringValue(charge.error) ?? stringValue(charge.message) ?? 'Cobro rechazado') : null
        const paymentUpsert = await admin.from('subscription_payments').upsert({
          company_id: subscription.company_id,
          subscription_id: subscription.id,
          provider: 'culqi',
          provider_event_id: eventId,
          provider_charge_id: chargeId,
          amount_cents: amountCents,
          currency: currency === 'USD' ? 'USD' : 'PEN',
          status: type.endsWith('.succeeded') ? 'paid' : 'failed',
          card_brand: brand,
          card_last_four: lastFour,
          failure_message: failureMessage,
          paid_at: type.endsWith('.succeeded') ? (unixToIso(charge.charge_day) ?? new Date().toISOString()) : null,
        }, { onConflict: 'provider,provider_event_id' })
        throwSupabaseError(paymentUpsert.error)
      }

      const processedEventUpdate = await admin.from('billing_events').update({
        company_id: subscription.company_id,
        subscription_id: subscription.id,
        processed_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', eventRowId)
      throwSupabaseError(processedEventUpdate.error)
    } else {
      const orphanEventUpdate = await admin.from('billing_events').update({
        processed_at: new Date().toISOString(),
        error: 'subscription_not_resolved',
        updated_at: new Date().toISOString(),
      }).eq('id', eventRowId)
      throwSupabaseError(orphanEventUpdate.error)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'webhook_processing_failed', message: error instanceof Error ? error.message : 'Webhook inválido.' }, { status: 422 })
  }
}
