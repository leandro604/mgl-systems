import { describe, expect, it } from 'vitest'
import { badgeVariants } from '@/components/ui/badge'
import { clampProgress } from '@/components/ui/progress-bar'

describe('Task 3 clean UI foundation', () => {
  it('clamps progress values for stable visual rendering', () => {
    expect(clampProgress(-10)).toBe(0)
    expect(clampProgress(40, 80)).toBe(50)
    expect(clampProgress(120)).toBe(100)
    expect(clampProgress(Number.NaN)).toBe(0)
  })

  it('maps semantic badge variants without decorative gradients', () => {
    expect(badgeVariants({ variant: 'success' })).toContain('green')
    expect(badgeVariants({ variant: 'warning' })).toContain('amber')
    expect(badgeVariants({ variant: 'danger' })).toContain('red')
    expect(badgeVariants({ variant: 'critical' })).toContain('red-900')
    expect(badgeVariants({ variant: 'info' })).toContain('blue')
    expect(badgeVariants({ variant: 'neutral' })).not.toContain('gradient')
  })
})
