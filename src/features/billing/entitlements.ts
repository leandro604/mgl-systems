import { billingAdminClient, isBillingSchemaUnavailable, mapPlan } from './server'
import type { BillingFeature, SubscriptionPlan } from './types'

export type BillingEnforcementMode = 'off' | 'limits' | 'strict'

export function billingEnforcementMode(): BillingEnforcementMode {
  const value = process.env.MGL_BILLING_ENFORCEMENT
  return value === 'strict' || value === 'limits' ? value : 'off'
}

async function activePlan(companyId: string): Promise<SubscriptionPlan | null> {
  const admin = billingAdminClient()
  const { data: subscription, error } = await admin
    .from('company_subscriptions')
    .select('plan_id,status')
    .eq('company_id', companyId)
    .in('status', ['trialing', 'active', 'past_due'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (isBillingSchemaUnavailable(error)) return null
  if (error) throw error
  if (!subscription) return null
  const { data: plan, error: planError } = await admin.from('subscription_plans').select('*').eq('id', subscription.plan_id).maybeSingle()
  if (isBillingSchemaUnavailable(planError)) return null
  if (planError) throw planError
  return plan ? mapPlan(plan) : null
}

export async function companyHasFeature(companyId: string, feature: BillingFeature) {
  if (billingEnforcementMode() === 'off') return true
  const plan = await activePlan(companyId)
  if (!plan) return billingEnforcementMode() !== 'strict'
  return plan.features.includes(feature)
}

export async function projectCapacityMessage(companyId: string) {
  if (billingEnforcementMode() === 'off') return null
  const plan = await activePlan(companyId)
  if (!plan) return billingEnforcementMode() === 'strict' ? 'Activa una suscripción para crear proyectos.' : null
  if (plan.maxProjects === null) return null
  const admin = billingAdminClient()
  const { count, error } = await admin.from('projects').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null)
  if (error) throw error
  return (count ?? 0) >= plan.maxProjects ? `Tu plan permite hasta ${plan.maxProjects} proyectos.` : null
}

export async function userCapacityMessage(companyId: string) {
  if (billingEnforcementMode() === 'off') return null
  const plan = await activePlan(companyId)
  if (!plan) return billingEnforcementMode() === 'strict' ? 'Activa una suscripción para agregar usuarios.' : null
  if (plan.maxUsers === null) return null
  const admin = billingAdminClient()
  const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null)
  if (error) throw error
  return (count ?? 0) >= plan.maxUsers ? `Tu plan permite hasta ${plan.maxUsers} usuarios.` : null
}
