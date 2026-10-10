import { describe, expect, it } from 'vitest'
import { calculateStockValue, inventoryStatusClass, stockHealth, stockHealthLabel } from '@/features/inventory/format'

describe('Phase 7 inventory helpers', () => {
  it('classifies stock as out, low and available', () => {
    expect(stockHealth(0, 5)).toBe('out')
    expect(stockHealth(2, 5)).toBe('low')
    expect(stockHealth(5, 5)).toBe('ok')
    expect(stockHealthLabel(0, 5)).toBe('Sin stock')
    expect(stockHealthLabel(2, 5)).toBe('Stock bajo')
    expect(stockHealthLabel(7, 5)).toBe('Disponible')
  })

  it('calculates stock value with cent precision', () => {
    expect(calculateStockValue(3, 10.125)).toBe(30.38)
    expect(calculateStockValue(0, 999)).toBe(0)
  })

  it('maps inventory workflow states to semantic visual classes', () => {
    expect(inventoryStatusClass('posted')).toContain('emerald')
    expect(inventoryStatusClass('submitted')).toContain('cyan')
    expect(inventoryStatusClass('cancelled')).toContain('red')
    expect(inventoryStatusClass('unknown')).toContain('slate')
  })
})
