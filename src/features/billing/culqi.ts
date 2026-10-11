import type { BillingInterval, SubscriptionStatus } from './types'

const CULQI_API = 'https://api.culqi.com/v2'

type JsonObject = Record<string, unknown>

export class CulqiApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'CulqiApiError'
    this.status = status
    this.payload = payload
  }
}

function secretKey() {
  const value = process.env.CULQI_SECRET_KEY
  if (!value) throw new Error('Falta CULQI_SECRET_KEY.')
  return value
}

function culqiMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback
  const row = payload as Record<string, unknown>
  for (const key of ['user_message', 'merchant_message', 'message']) {
    if (typeof row[key] === 'string' && row[key]) return row[key]
  }
  return fallback
}

export async function culqiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CULQI_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new CulqiApiError(culqiMessage(payload, 'Culqi rechazó la operación.'), response.status, payload)
  return payload as T
}

export function culqiStatusToSubscriptionStatus(value: unknown): SubscriptionStatus {
  const status = typeof value === 'number' ? value : Number(value)
  if (status === 2) return 'trialing'
  if (status === 3 || status === 1 || status === 5) return status === 3 ? 'active' : 'pending'
  if (status === 4) return 'canceled'
  if (status === 6) return 'ended'
  return 'pending'
}

export function planIntervalToCulqiUnit(interval: BillingInterval) {
  return interval === 'year' ? 4 : 3
}

export function unixToIso(value: unknown): string | null {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000
  return new Date(ms).toISOString()
}

export function asObject(value: unknown): JsonObject | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonObject : null
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

export async function createCulqiPlan(input: {
  name: string
  code: string
  interval: BillingInterval
  amountCents: number
  currency: 'PEN' | 'USD'
}) {
  return culqiRequest<{ id: string; slug?: string }>('/recurrent/plans/create', {
    method: 'POST',
    body: JSON.stringify({
      name: `MGL ${input.name} ${input.interval === 'year' ? 'Anual' : 'Mensual'}`.slice(0, 50),
      short_name: `mgl-${input.code}-${input.interval}`.slice(0, 50),
      description: `Suscripción MGL Systems - ${input.name}`.slice(0, 200),
      amount: input.amountCents,
      currency: input.currency,
      interval_unit_time: planIntervalToCulqiUnit(input.interval),
      interval_count: 1,
      initial_cycles: { count: 0, has_initial_charge: false, amount: 0, interval_unit_time: planIntervalToCulqiUnit(input.interval) },
      metadata: { product: 'mgl-systems', tier: input.code, interval: input.interval },
    }),
  })
}

export async function createCulqiCustomer(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  companyId: string
}) {
  return culqiRequest<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone_number: input.phone,
      address: input.address,
      address_city: input.city,
      country_code: 'PE',
      metadata: { mgl_company_id: input.companyId },
    }),
  })
}

export async function createCulqiCard(input: { customerId: string; tokenId: string; companyId: string }) {
  return culqiRequest<{
    id: string
    source?: { last_four?: string; iin?: { card_brand?: string } }
  }>('/cards', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: input.customerId,
      token_id: input.tokenId,
      validate: false,
      metadata: { mgl_company_id: input.companyId },
    }),
  })
}

export async function createCulqiSubscription(input: {
  cardId: string
  planId: string
  companyId: string
  localSubscriptionId: string
  planCode: string
}) {
  return culqiRequest<{
    id: string
    status?: number
    customer_id?: string
    plan_id?: string
    next_billing_date?: number
    created_at?: number
    creation_date?: number
  }>('/recurrent/subscriptions/create', {
    method: 'POST',
    body: JSON.stringify({
      card_id: input.cardId,
      plan_id: input.planId,
      tyc: true,
      metadata: {
        mgl_company_id: input.companyId,
        mgl_subscription_id: input.localSubscriptionId,
        mgl_plan_code: input.planCode,
      },
    }),
  })
}

export async function cancelCulqiSubscription(subscriptionId: string) {
  return culqiRequest<{ id?: string; delete?: boolean; deleted?: boolean }>(`/recurrent/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
  })
}

export async function getCulqiEvent(eventId: string) {
  return culqiRequest<JsonObject>(`/events/${encodeURIComponent(eventId)}`)
}
