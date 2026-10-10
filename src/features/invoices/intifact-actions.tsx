'use client'

import { useState } from 'react'
import { Download, FileArchive, FileCode2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import { downloadPdf, enqueueIntifactSend, generateInvoicePdf, type PrintableInvoice } from './offline'
import { useRouter } from 'next/navigation'

export function IntifactActions({ invoice }: { invoice: PrintableInvoice }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const canEmit = invoice.status !== 'draft' && invoice.series !== null && invoice.number !== null && invoice.status !== 'accepted' && invoice.status !== 'voided'
  const hasProviderDocument = Boolean(invoice.intifactDocumentId) || invoice.emissionProvider === 'sunat_direct'

  async function localPdf(pending = false) {
    const bytes = await generateInvoicePdf(invoice, pending)
    const number = invoice.series && invoice.number !== null ? `${invoice.series}-${String(invoice.number).padStart(8, '0')}` : 'borrador'
    downloadPdf(bytes, `${number}${pending ? '-pendiente' : ''}.pdf`)
  }

  function downloadAsset(asset: 'pdf' | 'xml' | 'cdr') {
    if (asset === 'pdf' && !navigator.onLine) {
      void localPdf(invoice.status !== 'accepted')
      return
    }
    window.location.assign(`/api/invoices/${invoice.id}/${asset}`)
  }

  async function emit() {
    setBusy(true)
    setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      if (!navigator.onLine) {
        await enqueueIntifactSend(db, identity, invoice.id, invoice.projectId)
        await localPdf(true)
        setMessage('Pendiente de envío')
        return
      }
      const client = createClient()
      const { data, error } = await client.functions.invoke('emitir-factura', { body: { invoice_id: invoice.id } })
      if (error) {
        const context = 'context' in error ? error.context : null
        if (context instanceof Response) {
          const payload = await context.clone().json().catch(() => null)
          if (payload && typeof payload === 'object') {
            const detail = 'detail' in payload && payload.detail ? String(payload.detail) : 'error' in payload ? String(payload.error) : ''
            if (detail) throw new Error(detail)
          }
        }
        throw error
      }
      if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
        const detail = 'error' in data ? String(data.error) : 'No se pudo emitir'
        throw new Error(detail)
      }
      const provider = data && typeof data === 'object' && 'provider' in data ? String(data.provider) : ''
      setMessage(provider === 'sunat_direct' ? 'Enviado directamente a SUNAT' : 'Enviado al proveedor electrónico')
      router.refresh()
    } catch (error) {
      if (!navigator.onLine) {
        const { db, identity } = await resolveOperationalRuntime()
        await enqueueIntifactSend(db, identity, invoice.id, invoice.projectId)
      }
      setMessage(error instanceof Error ? error.message : 'No se pudo emitir')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return <div className="flex flex-wrap items-center gap-2">
    {canEmit ? <Button type="button" onClick={emit} disabled={busy}><Send className="size-4" />{busy ? 'Enviando...' : 'Emitir a SUNAT'}</Button> : null}
    <Button type="button" variant="secondary" onClick={() => downloadAsset('pdf')}><Download className="size-4" />PDF MGL</Button>
    {hasProviderDocument ? <Button type="button" variant="secondary" onClick={() => downloadAsset('xml')}><FileCode2 className="size-4" />XML</Button> : null}
    {invoice.status === 'accepted' && hasProviderDocument ? <Button type="button" variant="secondary" onClick={() => downloadAsset('cdr')}><FileArchive className="size-4" />CDR</Button> : null}
    {message ? <span className="text-xs text-slate-500">{message}</span> : null}
  </div>
}
