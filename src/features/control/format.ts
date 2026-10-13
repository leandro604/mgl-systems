export const budgetStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  baseline: 'Línea base',
  superseded: 'Superado',
  archived: 'Archivado',
}

export const valuationStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Presentada',
  approved: 'Aprobada',
  observed: 'Observada',
}

export function controlStatusClass(status: string) {
  if (status === 'approved') return 'border-green-200 bg-green-50 text-green-700'
  if (status === 'submitted') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'observed') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

export function pct(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} %`
}

export function calculateControlVariance(budget: number, committed: number) {
  const safeBudget = Number.isFinite(budget) ? Math.max(0, budget) : 0
  const safeCommitted = Number.isFinite(committed) ? Math.max(0, committed) : 0
  return {
    balance: Math.round((safeBudget - safeCommitted) * 100) / 100,
    utilization: safeBudget > 0 ? Math.round((safeCommitted / safeBudget) * 10000) / 100 : 0,
  }
}
