import { describe, expect, it } from 'vitest'
import { calculateTaxedLine, financialStatusClass, invoiceStatusLabel } from '@/features/finance/format'

describe('phase 5 finance foundation', () => {
  it('calculates net, IGV and total with database-compatible rounding', () => {
    expect(calculateTaxedLine(2, 100)).toEqual({ net: 200, tax: 36, total: 236 })
    expect(calculateTaxedLine(1, 10)).toEqual({ net: 10, tax: 1.8, total: 11.8 })
  })

  it('keeps accepted invoices visually distinct', () => {
    expect(financialStatusClass('accepted')).toContain('green')
    expect(invoiceStatusLabel.accepted).toBe('Aceptada')
  })

  it('supports zero-priced valid lines without negative totals', () => {
    expect(calculateTaxedLine(3, 0)).toEqual({ net: 0, tax: 0, total: 0 })
  })
})

