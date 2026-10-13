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
  if (['approved', 'posted'].includes(status)) return 'border-green-200 bg-green-50 text-green-700'
  if (['submitted'].includes(status)) return 'border-blue-200 bg-blue-50 text-blue-700'
  if (['rejected'].includes(status)) return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
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
