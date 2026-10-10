export type CommitmentStatus = 'committed' | 'executed' | 'cancelled' | 'closed'

export type CommitmentAmounts = {
  committed: number
  executed: number
  available: number
  overBudget: boolean
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateCommitmentAmounts(input: {
  quotedAmount: number
  commitments: Array<{ amount: number; status: CommitmentStatus }>
}): CommitmentAmounts {
  const committed = money(
    input.commitments
      .filter((item) => item.status === 'committed')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  )
  const executed = money(
    input.commitments
      .filter((item) => item.status === 'executed' || item.status === 'closed')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  )
  const quotedAmount = money(Number(input.quotedAmount || 0))
  const available = money(quotedAmount - committed - executed)
  return { committed, executed, available, overBudget: committed + executed > quotedAmount }
}
