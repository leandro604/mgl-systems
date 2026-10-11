import { describe, expect, it } from 'vitest'
import { culqiStatusToSubscriptionStatus, planIntervalToCulqiUnit, unixToIso } from '@/features/billing/culqi'
import { fallbackSubscriptionPlans } from '@/features/billing/catalog'

describe('Culqi subscriptions', () => {
  it('maps Culqi subscription states', () => {
    expect(culqiStatusToSubscriptionStatus(1)).toBe('pending')
    expect(culqiStatusToSubscriptionStatus(2)).toBe('trialing')
    expect(culqiStatusToSubscriptionStatus(3)).toBe('active')
    expect(culqiStatusToSubscriptionStatus(4)).toBe('canceled')
    expect(culqiStatusToSubscriptionStatus(6)).toBe('ended')
  })

  it('uses Culqi monthly and annual interval units', () => {
    expect(planIntervalToCulqiUnit('month')).toBe(3)
    expect(planIntervalToCulqiUnit('year')).toBe(4)
  })

  it('ships monthly and annual variants for every tier', () => {
    for (const code of ['basic', 'pro', 'empresa']) {
      expect(fallbackSubscriptionPlans.some((plan) => plan.code === code && plan.billingInterval === 'month')).toBe(true)
      expect(fallbackSubscriptionPlans.some((plan) => plan.code === code && plan.billingInterval === 'year')).toBe(true)
    }
  })

  it('normalizes Culqi unix timestamps', () => {
    expect(unixToIso(1_700_000_000)).toBe(new Date(1_700_000_000_000).toISOString())
  })
})
