import { describe, expect, it } from 'vitest'
import { parseMyWorkspaceInvitation, parseWorkspaceInvitations } from '@/features/team/parsers'

describe('workspace invitation parsers', () => {
  it('parses an invitation that can move an empty bootstrap workspace', () => {
    const invite = parseMyWorkspaceInvitation({
      id: '11111111-1111-4111-8111-111111111111',
      company_id: '22222222-2222-4222-8222-222222222222',
      company_name: 'MGL Systems',
      email: 'worker@example.com',
      role: 'field_worker',
      projects: [{ id: '33333333-3333-4333-8333-333333333333', code: 'P01', name: 'Hospital' }],
      expires_at: '2026-10-01T00:00:00Z',
      can_transfer: true,
    })
    expect(invite?.company_name).toBe('MGL Systems')
    expect(invite?.projects[0]?.name).toBe('Hospital')
    expect(invite?.role).toBe('field_worker')
  })

  it('rejects malformed invitation payloads', () => {
    expect(parseMyWorkspaceInvitation({ id: 'missing-fields' })).toBeNull()
    expect(parseMyWorkspaceInvitation(null)).toBeNull()
  })

  it('parses invitation history without trusting malformed rows', () => {
    const rows = parseWorkspaceInvitations([
      {
        id: '11111111-1111-4111-8111-111111111111', email: 'worker@example.com', role: 'supervisor',
        project_ids: ['33333333-3333-4333-8333-333333333333'], project_names: ['Hospital'], status: 'pending',
        created_at: '2026-09-27T00:00:00Z', expires_at: '2026-10-04T00:00:00Z', accepted_at: null,
      },
      { id: 'bad' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.project_names).toEqual(['Hospital'])
  })
})
