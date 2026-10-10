export const requestStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Solicitado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  fulfilled: 'Atendido',
  cancelled: 'Cancelado',
}

export const movementLabel: Record<string, string> = {
  receipt: 'Recepción de compra',
  issue: 'Salida a obra',
  transfer: 'Transferencia',
  adjustment_in: 'Ingreso manual',
  adjustment_out: 'Salida por ajuste',
}

export function inventoryStatusClass(status: string) {
  if (['approved', 'fulfilled', 'posted'].includes(status)) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (['submitted', 'draft'].includes(status)) return 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
  if (['rejected', 'cancelled'].includes(status)) return 'border-red-400/20 bg-red-400/10 text-red-200'
  return 'border-slate-700 bg-slate-800 text-slate-300'
}

export function stockHealth(quantity: number, minStock: number) {
  if (quantity <= 0) return 'out' as const
  if (minStock > 0 && quantity < minStock) return 'low' as const
  return 'ok' as const
}

export function stockHealthLabel(quantity: number, minStock: number) {
  const state = stockHealth(quantity, minStock)
  return state === 'out' ? 'Sin stock' : state === 'low' ? 'Stock bajo' : 'Disponible'
}

export function calculateStockValue(quantity: number, averageUnitCost: number) {
  return Math.round((quantity * averageUnitCost + Number.EPSILON) * 100) / 100
}
