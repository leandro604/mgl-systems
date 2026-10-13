'use client'

import { useActionState } from 'react'
import { FilePlus2, ListPlus, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from '@/features/auth/types'
import { addInvoiceLineAction, createFiscalSeriesAction, createInvoiceAction, queueInvoiceAction } from './actions'

const selectClass = 'flex h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15'

function Message({ state }: { state: typeof initialFormState }) {
  if (!state.message) return null
  return <div className={state.status === 'success' ? 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200' : 'rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200'}>{state.message}</div>
}

export function FiscalSeriesForm() {
  const [state, action] = useActionState(createFiscalSeriesAction, initialFormState)
  return <form action={action} className="space-y-4">
    <Message state={state} />
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="document_type">Comprobante</Label><select id="document_type" name="document_type" className={selectClass} defaultValue="01"><option value="01">Factura</option><option value="03">Boleta</option></select></div>
      <div className="space-y-2"><Label htmlFor="series">Serie</Label><Input id="series" name="series" placeholder="F001" maxLength={4} required /></div>
      <div className="space-y-2"><Label htmlFor="next_number">Siguiente correlativo</Label><Input id="next_number" name="next_number" type="number" min="1" defaultValue="1" required /></div>
    </div>
    <SubmitButton pendingLabel="Configurando..."><ListPlus />Crear serie fiscal</SubmitButton>
  </form>
}

export function InvoiceForm({ projectId, currency }: { projectId: string; currency: string }) {
  const [state, action] = useActionState(createInvoiceAction, initialFormState)
  const today = new Date().toISOString().slice(0, 10)
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} />
    <Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="document_type">Tipo</Label><select id="document_type" name="document_type" className={selectClass} defaultValue="01"><option value="01">Factura electrónica</option><option value="03">Boleta electrónica</option></select></div>
      <div className="space-y-2"><Label htmlFor="issued_on">Fecha de emisión</Label><Input id="issued_on" name="issued_on" type="date" defaultValue={today} required /></div>
      <div className="space-y-2"><Label htmlFor="currency">Moneda</Label><select id="currency" name="currency" className={selectClass} defaultValue={currency}><option value="PEN">PEN · Soles</option><option value="USD">USD · Dólares</option></select></div>
      <div className="space-y-2"><Label htmlFor="customer_document_type">Documento cliente</Label><select id="customer_document_type" name="customer_document_type" className={selectClass} defaultValue="6"><option value="6">RUC</option><option value="1">DNI</option><option value="0">Sin documento</option></select></div>
      <div className="space-y-2"><Label htmlFor="customer_document_number">Número documento</Label><Input id="customer_document_number" name="customer_document_number" required /></div>
      <div className="space-y-2"><Label htmlFor="customer_name">Cliente</Label><Input id="customer_name" name="customer_name" required /></div>
      <div className="space-y-2 sm:col-span-2 xl:col-span-3"><Label htmlFor="customer_address">Dirección</Label><Input id="customer_address" name="customer_address" /></div>
    </div>
    <SubmitButton pendingLabel="Creando borrador..."><FilePlus2 />Crear comprobante</SubmitButton>
  </form>
}

export function InvoiceLineForm({ projectId, invoiceId }: { projectId: string; invoiceId: string }) {
  const [state, action] = useActionState(addInvoiceLineAction, initialFormState)
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="invoice_id" value={invoiceId} />
    <Message state={state} />
    <div className="grid gap-4 lg:grid-cols-[1.6fr_.45fr_.55fr_.7fr]">
      <div className="space-y-2"><Label htmlFor="description">Descripción</Label><Input id="description" name="description" placeholder="Descripción" required /></div>
      <div className="space-y-2"><Label htmlFor="unit_code">Unidad</Label><Input id="unit_code" name="unit_code" defaultValue="NIU" required /></div>
      <div className="space-y-2"><Label htmlFor="quantity">Cantidad</Label><Input id="quantity" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required /></div>
      <div className="space-y-2"><Label htmlFor="unit_price">P. unitario sin IGV</Label><Input id="unit_price" name="unit_price" type="number" min="0" step="0.01" required /></div>
    </div>
    <SubmitButton pendingLabel="Agregando..."><ListPlus />Agregar partida</SubmitButton>
  </form>
}

export function QueueInvoiceForm({ projectId, invoiceId, documentType, series }: { projectId: string; invoiceId: string; documentType: string; series: Array<{ series: string; next_number: number; document_type: string }> }) {
  const [state, action] = useActionState(queueInvoiceAction, initialFormState)
  const available = series.filter((item) => item.document_type === documentType)
  return <form action={action} className="space-y-3">
    <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="invoice_id" value={invoiceId} />
    <Message state={state} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="series">Serie fiscal</Label><select id="series" name="series" className={selectClass} defaultValue="" required><option value="" disabled>Seleccionar serie</option>{available.map((item) => <option key={item.series} value={item.series}>{item.series} · próximo {item.next_number}</option>)}</select></div>
      <SubmitButton disabled={available.length === 0} pendingLabel="Numerando..."><Send />Numerar y poner en cola</SubmitButton>
    </div>
    {available.length === 0 ? <p className="text-xs text-amber-300">No existe una serie activa para este tipo de comprobante. Configúrala en Facturación.</p> : null}
  </form>
}
