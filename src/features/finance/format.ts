export function formatMoney(value: number | null | undefined, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value ?? 0))
}

export const purchaseStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  received: 'Recibida',
  cancelled: 'Cancelada',
}

export const invoiceStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  queued: 'En cola',
  processing: 'Procesando',
  submitted: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  unknown: 'Por conciliar',
  voided: 'Anulada',
}

export function financialStatusClass(status: string) {
  if (status === 'accepted' || status === 'received') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (status === 'rejected' || status === 'cancelled' || status === 'voided') return 'border-red-400/20 bg-red-400/10 text-red-200'
  if (status === 'queued' || status === 'processing' || status === 'submitted' || status === 'issued') return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
  return 'border-slate-700 bg-slate-900 text-slate-300'
}


export function calculateTaxedLine(quantity: number, unitPrice: number, taxRate = 18) {
  const net = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100
  const tax = Math.round((net * taxRate / 100 + Number.EPSILON) * 100) / 100
  return { net, tax, total: Math.round((net + tax + Number.EPSILON) * 100) / 100 }
}
