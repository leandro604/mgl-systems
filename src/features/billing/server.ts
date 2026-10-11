import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getVerifiedSubject, requireWorkspaceContext } from '@/features/auth/server'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { CompanySubscriptionSummary, SubscriptionPaymentSummary, SubscriptionPlan } from './types'

export function billingAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o una clave privada de Supabase.')
  return createAdminClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function isBillingSchemaUnavailable(error: { code?: string } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST204'
}

function featureList(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function mapPlan(row: Database['public']['Tables']['subscription_plans']['Row']): SubscriptionPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    billingInterval: row.billing_interval === 'year' ? 'year' : 'month',
    priceCents: row.price_cents,
    currency: row.currency === 'USD' ? 'USD' : 'PEN',
    maxProjects: row.max_projects,
    maxUsers: row.max_users,
    features: featureList(row.features),
    providerPlanId: row.provider_plan_id,
  }
}

export async function getSubscriptionDashboard() {
  const context = await requireWorkspaceContext()
  if (context.profile.role !== 'admin') {
    return { ...context, allowed: false as const, plans: [], subscription: null, payments: [], culqiConfigured: false, publicKey: '' }
  }

  const admin = billingAdminClient()
  const [plansResult, subscriptionsResult, paymentsResult] = await Promise.all([
    admin.from('subscription_plans').select('*').eq('active', true).is('deleted_at', null).order('price_cents'),
    admin.from('company_subscriptions').select('*').eq('company_id', context.company.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1),
    admin.from('subscription_payments').select('*').eq('company_id', context.company.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(12),
  ])

  const schemaPending = [plansResult.error, subscriptionsResult.error, paymentsResult.error].some(isBillingSchemaUnavailable)
  if (!schemaPending) {
    if (plansResult.error) throw plansResult.error
    if (subscriptionsResult.error) throw subscriptionsResult.error
    if (paymentsResult.error) throw paymentsResult.error
  }

  const plans = (plansResult.data ?? []).map(mapPlan)
  const planById = new Map(plans.map((plan) => [plan.id, plan]))
  const row = subscriptionsResult.data?.[0] ?? null
  const plan = row ? planById.get(row.plan_id) : undefined
  const subscription: CompanySubscriptionSummary | null = row && plan ? {
    id: row.id,
    planId: row.plan_id,
    planCode: plan.code,
    planName: plan.name,
    billingInterval: plan.billingInterval,
    priceCents: plan.priceCents,
    currency: plan.currency,
    status: row.status as CompanySubscriptionSummary['status'],
    cardBrand: row.card_brand,
    cardLastFour: row.card_last_four,
    nextBillingAt: row.next_billing_at,
    canceledAt: row.canceled_at,
    createdAt: row.created_at,
  } : null

  const payments: SubscriptionPaymentSummary[] = (paymentsResult.data ?? []).map((payment) => ({
    id: payment.id,
    amountCents: payment.amount_cents,
    currency: payment.currency === 'USD' ? 'USD' : 'PEN',
    status: payment.status as SubscriptionPaymentSummary['status'],
    cardBrand: payment.card_brand,
    cardLastFour: payment.card_last_four,
    failureMessage: payment.failure_message,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
  }))

  const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? ''
  return {
    ...context,
    allowed: true as const,
    schemaPending,
    plans,
    subscription,
    payments,
    culqiConfigured: Boolean(publicKey && process.env.CULQI_SECRET_KEY),
    publicKey,
  }
}


export async function getBillingApiContext() {
  const auth = await getVerifiedSubject()
  if (!auth.userId) return null
  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('user_id,company_id,full_name,role,deleted_at')
    .eq('user_id', auth.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (profileError || !profile) return null
  const claims = auth.claims as Record<string, unknown> | null
  const emailClaim = claims && typeof claims.email === 'string' ? claims.email : ''
  return { supabase: auth.supabase, userId: auth.userId, profile, email: emailClaim }
}
