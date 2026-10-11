import type { SubscriptionPlan } from './types'

const common = {
  currency: 'PEN' as const,
  providerPlanId: null,
}

export const fallbackSubscriptionPlans: SubscriptionPlan[] = [
  { id: 'basic-month', code: 'basic', name: 'Básico', billingInterval: 'month', priceCents: 4900, maxProjects: 3, maxUsers: 5, features: ['projects', 'tasks', 'documents', 'sst'], ...common },
  { id: 'basic-year', code: 'basic', name: 'Básico', billingInterval: 'year', priceCents: 49000, maxProjects: 3, maxUsers: 5, features: ['projects', 'tasks', 'documents', 'sst'], ...common },
  { id: 'pro-month', code: 'pro', name: 'Pro', billingInterval: 'month', priceCents: 9900, maxProjects: 10, maxUsers: 20, features: ['projects', 'tasks', 'documents', 'sst', 'inventory', 'planning', 'control', 'purchases', 'finance', 'reports'], ...common },
  { id: 'pro-year', code: 'pro', name: 'Pro', billingInterval: 'year', priceCents: 99000, maxProjects: 10, maxUsers: 20, features: ['projects', 'tasks', 'documents', 'sst', 'inventory', 'planning', 'control', 'purchases', 'finance', 'reports'], ...common },
  { id: 'empresa-month', code: 'empresa', name: 'Empresa', billingInterval: 'month', priceCents: 19900, maxProjects: null, maxUsers: 50, features: ['projects', 'tasks', 'documents', 'sst', 'inventory', 'planning', 'control', 'purchases', 'finance', 'reports', 'drive', 'sunat'], ...common },
  { id: 'empresa-year', code: 'empresa', name: 'Empresa', billingInterval: 'year', priceCents: 199000, maxProjects: null, maxUsers: 50, features: ['projects', 'tasks', 'documents', 'sst', 'inventory', 'planning', 'control', 'purchases', 'finance', 'reports', 'drive', 'sunat'], ...common },
]
