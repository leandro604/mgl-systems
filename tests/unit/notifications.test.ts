import { describe, expect, it } from 'vitest'
import { defaultLocalPreference } from '@/features/notifications/repository'
import { notificationActionUrl, notificationKindLabel, notificationKindTone } from '@/features/notifications/notification-utils'

describe('Task 9 notification helpers', () => {
  it('keeps in-app enabled and uses safe notification defaults', () => {
    const row = defaultLocalPreference('company-1', 'user-1')
    expect(row.company_id).toBe('company-1')
    expect(row.user_id).toBe('user-1')
    expect(row.in_app_enabled).toBe(true)
    expect(row.email_enabled).toBe(true)
    expect(row.push_enabled).toBe(false)
    expect(row.timezone).toBe('America/Lima')
    expect(row.pending_sync).toBe(false)
  })

  it('accepts only internal notification action paths', () => {
    expect(notificationActionUrl({ action_url: '/app/projects/abc/tasks?focus=123' })).toBe('/app/projects/abc/tasks?focus=123')
    expect(notificationActionUrl({ action_url: 'https://evil.example/' })).toBeNull()
    expect(notificationActionUrl({ action_url: '//evil.example/' })).toBeNull()
    expect(notificationActionUrl({ action_url: null })).toBeNull()
  })

  it('maps known notification kinds to semantic labels and tones', () => {
    expect(notificationKindLabel('task_assigned')).toBe('Tarea')
    expect(notificationKindTone('task_assigned')).toBe('info')
    expect(notificationKindLabel('material_request_pending')).toBe('Materiales')
    expect(notificationKindTone('material_request_pending')).toBe('warning')
    expect(notificationKindTone('cost_alert')).toBe('danger')
  })
})
