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
  if (status === 'baseline' || status === 'approved') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'submitted') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
  if (status === 'observed') return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  if (status === 'superseded' || status === 'archived') return 'border-slate-700 bg-slate-800/70 text-slate-400'
  return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
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
