import { describe, expect, it } from 'vitest'
import {
  materialRequestCreatePayloadSchema,
  materialRequestItemCreatePayloadSchema,
  materialRequestTransitionPayloadSchema,
} from '@/lib/sync/schemas'

describe('material request sync contract', () => {
  it('accepts an offline request header payload', () => {
    const value = materialRequestCreatePayloadSchema.parse({
      number: 'REQ-260929-001',
      title: 'Cable para frente norte',
      approver_id: '7f1be007-9dba-488f-b374-59a89d8cac46',
      priority: 'high',
      stage_id: '45abeeb3-bd87-4168-a735-3996effdc10c',
      budget_item_id: null,
    })
    expect(value.priority).toBe('high')
    expect(value.budget_item_id).toBeNull()
  })

  it('rejects invalid quantities', () => {
    expect(() => materialRequestItemCreatePayloadSchema.parse({
      request_id: '0a3b2101-25dd-4ee8-a3c9-5bc763187365',
      material_id: '45abeeb3-bd87-4168-a735-3996effdc10c',
      quantity: 0,
      estimated_unit_price: 10,
    })).toThrow()
  })

  it('requires a rejection reason', () => {
    expect(() => materialRequestTransitionPayloadSchema.parse({ transition: 'rejected' })).toThrow()
    expect(materialRequestTransitionPayloadSchema.parse({ transition: 'rejected', reason: 'Sin sustento' }).reason).toBe('Sin sustento')
  })
})
