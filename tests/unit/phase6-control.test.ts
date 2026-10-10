import { describe, expect, it } from 'vitest'
import { calculateControlVariance, controlStatusClass, pct } from '@/features/control/format'

describe('phase 6 project control foundation', () => {
  it('calculates balance and cost utilization without IGV distortion', () => {
    expect(calculateControlVariance(1000, 250)).toEqual({ balance: 750, utilization: 25 })
  })

  it('surfaces cost overruns instead of clamping the economic variance', () => {
    expect(calculateControlVariance(1000, 1125)).toEqual({ balance: -125, utilization: 112.5 })
  })

  it('formats progress and keeps approved/baseline states positive', () => {
    expect(pct(41.087)).toBe('41.09 %')
    expect(controlStatusClass('approved')).toContain('emerald')
    expect(controlStatusClass('baseline')).toContain('emerald')
  })
})
