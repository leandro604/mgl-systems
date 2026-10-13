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
  if (status === 'accepted' || status === 'received') return 'border-green-200 bg-green-50 text-green-700'
  if (status === 'rejected' || status === 'cancelled' || status === 'voided') return 'border-red-200 bg-red-50 text-red-700'
  if (status === 'queued' || status === 'processing' || status === 'submitted' || status === 'issued') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}


export function calculateTaxedLine(quantity: number, unitPrice: number, taxRate = 18) {
  const net = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100
  const tax = Math.round((net * taxRate / 100 + Number.EPSILON) * 100) / 100
  return { net, tax, total: Math.round((net + tax + Number.EPSILON) * 100) / 100 }
}
