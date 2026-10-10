import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InvoiceLineForm, QueueInvoiceForm } from '@/features/invoices/forms'
import { IntifactActions } from '@/features/invoices/intifact-actions'
import { getInvoiceDetail } from '@/features/invoices/server'
import { financialStatusClass, formatMoney, invoiceStatusLabel } from '@/features/finance/format'

export default async function Page({params}:{params:Promise<{projectId:string;invoiceId:string}>}) {
  const {projectId,invoiceId}=await params
  const d=await getInvoiceDetail(projectId,invoiceId)
  if(!d.allowed||!d.invoice) return <Card><CardHeader><CardTitle>Comprobante</CardTitle><CardDescription>Sin acceso.</CardDescription></CardHeader></Card>
  const i=d.invoice
  const printable={
    id:i.id, projectId:i.project_id, projectName:d.project.name, documentType:i.document_type, series:i.series, number:i.number, issuedOn:i.issued_on,
    currency:i.currency, issuerName:d.company.legal_name, issuerRuc:d.company.ruc, issuerAddress:null,
    customerName:i.customer_name, customerDocumentType:i.customer_document_type, customerDocumentNumber:i.customer_document_number, customerAddress:i.customer_address,
    status:i.status, providerStatus:i.provider_status, cdrCode:i.cdr_code,
    items:d.items.map((x)=>({lineNumber:x.line_number,description:x.description,unitCode:x.unit_code,quantity:Number(x.quantity),unitPrice:Number(x.unit_price),netAmount:x.net_amount===null?null:Number(x.net_amount),taxAmount:x.tax_amount===null?null:Number(x.tax_amount)})),
    netAmount:Number(d.total?.net_amount??0), taxAmount:Number(d.total?.tax_amount??0), totalAmount:Number(d.total?.total_amount??0), intifactDocumentId:i.intifact_document_id,
    emissionProvider:i.emission_provider, sunatDigest:i.sunat_digest,
  }
  return <div className="space-y-5">
    <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{i.series&&i.number?`${i.series}-${String(i.number).padStart(8,'0')}`:'Borrador sin numerar'} · {i.customer_name}</CardTitle><CardDescription>{i.document_type==='01'?'Factura':'Boleta'} · {i.customer_document_number} · {i.issued_on}</CardDescription></div><Badge className={financialStatusClass(i.status)}>{invoiceStatusLabel[i.status]??i.status}</Badge></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Neto</p><p className="mt-1 font-semibold text-white">{formatMoney(Number(d.total?.net_amount??0),i.currency)}</p></div><div><p className="text-xs text-slate-500">IGV</p><p className="mt-1 font-semibold text-white">{formatMoney(Number(d.total?.tax_amount??0),i.currency)}</p></div><div><p className="text-xs text-slate-500">Total</p><p className="mt-1 text-xl font-black text-cyan-200">{formatMoney(Number(d.total?.total_amount??0),i.currency)}</p></div></div>
      {i.status==='draft'?<QueueInvoiceForm projectId={projectId} invoiceId={invoiceId} documentType={i.document_type} series={d.series}/>:null}
      <IntifactActions invoice={printable}/>
      {i.provider_status?<p className="text-xs text-slate-500">Proveedor/SUNAT: {i.provider_status}</p>:null}
      {i.last_error?<p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{i.last_error}</p>:null}
      {i.cdr_code?<p className="text-sm text-emerald-300">CDR: {i.cdr_code}</p>:null}
    </CardContent></Card>
    {i.status==='draft'?<Card><CardHeader><CardTitle>Agregar partida</CardTitle></CardHeader><CardContent><InvoiceLineForm projectId={projectId} invoiceId={invoiceId}/></CardContent></Card>:null}
    <Card><CardHeader><CardTitle>Partidas</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">#</th><th>Descripción</th><th>Unidad</th><th>Cant.</th><th>P. unit.</th><th>Neto</th><th>IGV</th></tr></thead><tbody className="divide-y divide-slate-800">{d.items.map(x=><tr key={x.id}><td className="py-3">{x.line_number}</td><td>{x.description}</td><td>{x.unit_code}</td><td>{x.quantity}</td><td>{formatMoney(x.unit_price,i.currency)}</td><td>{formatMoney(x.net_amount,i.currency)}</td><td>{formatMoney(x.tax_amount,i.currency)}</td></tr>)}</tbody></table></CardContent></Card>
  </div>
}
