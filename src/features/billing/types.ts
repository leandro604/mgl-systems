export type BillingInterval = 'month' | 'year'
export type SubscriptionStatus = 'pending' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'ended' | 'failed'

export type SubscriptionPlan = {
  id: string
  code: string
  name: string
  billingInterval: BillingInterval
  priceCents: number
  currency: 'PEN' | 'USD'
  maxProjects: number | null
  maxUsers: number | null
  features: string[]
  providerPlanId: string | null
}

export type CompanySubscriptionSummary = {
  id: string
  planId: string
  planCode: string
  planName: string
  billingInterval: BillingInterval
  priceCents: number
  currency: 'PEN' | 'USD'
  status: SubscriptionStatus
  cardBrand: string | null
  cardLastFour: string | null
  nextBillingAt: string | null
  canceledAt: string | null
  createdAt: string
}

export type SubscriptionPaymentSummary = {
  id: string
  amountCents: number
  currency: 'PEN' | 'USD'
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  cardBrand: string | null
  cardLastFour: string | null
  failureMessage: string | null
  paidAt: string | null
  createdAt: string
}

export const ALL_BILLING_FEATURES = [
  'projects',
  'tasks',
  'documents',
  'sst',
  'inventory',
  'planning',
  'control',
  'purchases',
  'finance',
  'reports',
  'drive',
  'sunat',
] as const

export type BillingFeature = (typeof ALL_BILLING_FEATURES)[number]
