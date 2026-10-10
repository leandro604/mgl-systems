import { describe, expect, it } from 'vitest'
import { calculateCommitmentAmounts } from '@/features/budget/commitment-calculator'

describe('budget commitment calculator', () => {
  it('mirrors committed/executed/available SQL semantics', () => {
    expect(calculateCommitmentAmounts({
      quotedAmount: 1000,
      commitments: [
        { amount: 250, status: 'committed' },
        { amount: 300, status: 'executed' },
        { amount: 90, status: 'cancelled' },
        { amount: 50, status: 'closed' },
      ],
    })).toEqual({ committed: 250, executed: 350, available: 400, overBudget: false })
  })

  it('flags over budget', () => {
    expect(calculateCommitmentAmounts({
      quotedAmount: 100,
      commitments: [{ amount: 60, status: 'committed' }, { amount: 50, status: 'executed' }],
    }).overBudget).toBe(true)
  })
})
