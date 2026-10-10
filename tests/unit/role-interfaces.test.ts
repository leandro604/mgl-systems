import { describe, expect, it } from 'vitest'
import {
  canAccessFinancialModules,
  canConfigureCompany,
  homeForRole,
  isFieldWorkerRole,
  isManagementRole,
} from '../../src/features/auth/roles'

describe('role based interfaces', () => {
  it('routes field workers to the operational interface', () => {
    expect(isFieldWorkerRole('field_worker')).toBe(true)
    expect(homeForRole('field_worker')).toBe('/field/hoy')
  })

  it.each(['admin', 'pm', 'supervisor'] as const)('routes %s to the management interface', (role) => {
    expect(isManagementRole(role)).toBe(true)
    expect(homeForRole(role)).toBe('/app')
  })

  it('keeps financial modules limited to admin and PM', () => {
    expect(canAccessFinancialModules('admin')).toBe(true)
    expect(canAccessFinancialModules('pm')).toBe(true)
    expect(canAccessFinancialModules('supervisor')).toBe(false)
    expect(canAccessFinancialModules('field_worker')).toBe(false)
  })

  it('keeps company configuration limited to administrators', () => {
    expect(canConfigureCompany('admin')).toBe(true)
    expect(canConfigureCompany('pm')).toBe(false)
    expect(canConfigureCompany('supervisor')).toBe(false)
    expect(canConfigureCompany('field_worker')).toBe(false)
  })
})
