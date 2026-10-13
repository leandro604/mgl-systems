'use client'

import { useEffect, useRef, useState } from 'react'
import { CloudUpload, Download, ExternalLink, FileArchive, FileCode2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import { downloadPdf, enqueueIntifactSend, generateInvoicePdf, type InvoicePdfFormat, type PrintableInvoice } from './offline'
import { useRouter } from 'next/navigation'

const PDF_FORMATS: Array<{ value: InvoicePdfFormat; label: string }> = [
  { value: 'a4', label: 'A4' },
  { value: 'a5', label: 'A5' },
  { value: 'ticket80', label: 'Ticket 80 mm' },
  { value: 'ticket58', label: 'Ticket 58 mm' },
]

export function IntifactActions({
  invoice,
  defaultPdfFormat = 'a4',
  driveEnabled = false,
  driveSynced = false,
  driveFolderUrl = null,
}: {
  invoice: PrintableInvoice
  defaultPdfFormat?: InvoicePdfFormat
  driveEnabled?: boolean
  driveSynced?: boolean
  driveFolderUrl?: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [driveBusy, setDriveBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pdfFormat, setPdfFormat] = useState<InvoicePdfFormat>(defaultPdfFormat)
  const [synced, setSynced] = useState(driveSynced)
  const autoSyncAttempted = useRef(false)
  const router = useRouter()
  const canEmit = invoice.status !== 'draft' && invoice.series !== null && invoice.number !== null && invoice.status !== 'accepted' && invoice.status !== 'voided'
  const hasProviderDocument = Boolean(invoice.intifactDocumentId) || invoice.emissionProvider === 'sunat_direct' || synced

  async function localPdf(pending = false) {
    const bytes = await generateInvoicePdf(invoice, pending, pdfFormat)
    const number = invoice.series && invoice.number !== null ? `${invoice.series}-${String(invoice.number).padStart(8, '0')}` : 'borrador'
    downloadPdf(bytes, `${number}${pdfFormat === 'a4' ? '' : `-${pdfFormat}`}${pending ? '-pendiente' : ''}.pdf`)
  }

  function downloadAsset(asset: 'pdf' | 'xml' | 'cdr') {
    if (asset === 'pdf' && !navigator.onLine) {
      void localPdf(invoice.status !== 'accepted')
      return
    }
    const query = asset === 'pdf' ? `?format=${encodeURIComponent(pdfFormat)}` : ''
    window.location.assign(`/api/invoices/${invoice.id}/${asset}${query}`)
  }

  async function syncDrive(silent = false) {
    if (!driveEnabled || !navigator.onLine) return false
    setDriveBusy(true)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/sync-drive`, { method: 'POST' })
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'No se pudo guardar el comprobante en Google Drive.')
      setSynced(true)
      if (!silent) setMessage('PDF, XML y CDR guardados en Google Drive')
      router.refresh()
      return true
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : 'No se pudo sincronizar con Google Drive')
      return false
    } finally {
      setDriveBusy(false)
    }
  }

  useEffect(() => {
    if (autoSyncAttempted.current || invoice.status !== 'accepted' || !driveEnabled || synced || typeof navigator === 'undefined' || !navigator.onLine) return
    autoSyncAttempted.current = true
    void syncDrive(true)
  // El reintento automático se ejecuta una sola vez al abrir un comprobante aceptado pendiente de Drive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveEnabled, invoice.status, synced])

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
      const providerStatus = data && typeof data === 'object' && 'status' in data ? String(data.status).toLowerCase() : ''
      setMessage(provider === 'sunat_direct' ? 'Enviado directamente a SUNAT' : 'Enviado al proveedor electrónico')
      if (driveEnabled && (provider === 'sunat_direct' || providerStatus === 'accepted' || providerStatus === 'aceptado')) {
        const archived = await syncDrive(true)
        if (archived) setMessage('Aceptado por SUNAT y archivado en Google Drive')
      }
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

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      {canEmit ? <Button type="button" onClick={emit} disabled={busy}><Send className="size-4" />{busy ? 'Enviando...' : 'Emitir a SUNAT'}</Button> : null}
      <select value={pdfFormat} onChange={(event) => setPdfFormat(event.target.value as InvoicePdfFormat)} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200">
        {PDF_FORMATS.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}
      </select>
      <Button type="button" variant="secondary" onClick={() => downloadAsset('pdf')}><Download className="size-4" />PDF</Button>
      {hasProviderDocument ? <Button type="button" variant="secondary" onClick={() => downloadAsset('xml')}><FileCode2 className="size-4" />XML</Button> : null}
      {invoice.status === 'accepted' && hasProviderDocument ? <Button type="button" variant="secondary" onClick={() => downloadAsset('cdr')}><FileArchive className="size-4" />CDR</Button> : null}
      {invoice.status === 'accepted' && driveEnabled ? <Button type="button" variant="secondary" disabled={driveBusy} onClick={() => void syncDrive(false)}><CloudUpload className="size-4" />{driveBusy ? 'Sincronizando...' : synced ? 'Re-sincronizar Drive' : 'Guardar en Drive'}</Button> : null}
      {synced && driveFolderUrl ? <Button type="button" variant="secondary" onClick={() => window.open(driveFolderUrl, '_blank', 'noopener,noreferrer')}><ExternalLink className="size-4" />Abrir carpeta</Button> : null}
    </div>
    {driveEnabled && invoice.status === 'accepted' ? <p className={`text-xs ${synced ? 'text-emerald-500' : 'text-amber-500'}`}>Google Drive: {synced ? 'sincronizado' : 'pendiente de sincronización'}</p> : null}
    {message ? <p className="text-xs text-slate-500">{message}</p> : null}
  </div>
}
