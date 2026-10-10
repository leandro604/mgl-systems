import type { Database } from '@/lib/supabase/database.types'

export type AppRole = Database['public']['Enums']['app_role']

export const MANAGEMENT_ROLES: readonly AppRole[] = ['admin', 'pm', 'supervisor']
export const FINANCIAL_ROLES: readonly AppRole[] = ['admin', 'pm']

export const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  pm: 'Project Manager',
  supervisor: 'Supervisor',
  field_worker: 'Trabajador de campo',
}

export function isFieldWorkerRole(role: string): role is 'field_worker' {
  return role === 'field_worker'
}

export function isManagementRole(role: string): role is 'admin' | 'pm' | 'supervisor' {
  return role === 'admin' || role === 'pm' || role === 'supervisor'
}

export function canAccessFinancialModules(role: string) {
  return role === 'admin' || role === 'pm'
}

export function canConfigureCompany(role: string) {
  return role === 'admin'
}

export function canAccessIntegrations(role: string) {
  return isManagementRole(role)
}

export function homeForRole(role: string) {
  return isFieldWorkerRole(role) ? '/field/hoy' : '/app'
}
