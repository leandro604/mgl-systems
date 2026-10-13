'use client'

import type { BrowserSupabaseClient } from '@/lib/supabase/client'
import type { MglLocalDb } from '@/lib/db/dexie'
import type { VerifiedIdentity } from '@/types/domain'

export { generateInvoicePdf } from './pdf'
export type { InvoicePdfFormat, PrintableInvoice } from './pdf'

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const copy = Uint8Array.from(bytes)
  const blob = new Blob([copy.buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function enqueueIntifactSend(db: MglLocalDb, identity: VerifiedIdentity, invoiceId: string, projectId: string) {
  const now = Date.now()
  await db.integrationJobs.put({
    id: `intifact:${invoiceId}`,
    kind: 'intifact_send',
    companyId: identity.companyId,
    projectId,
    userId: identity.userId,
    entityId: invoiceId,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  })
}

export async function processIntegrationJobs(db: MglLocalDb, client: BrowserSupabaseClient, userId: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const now = Date.now()
  const jobs = (await db.integrationJobs.toArray()).filter(
    (job) => job.userId === userId && (job.status === 'pending' || job.status === 'retry') && job.nextAttemptAt <= now,
  )
  for (const job of jobs) {
    try {
      const { data, error } = await client.functions.invoke('emitir-factura', { body: { invoice_id: job.entityId } })
      if (error) throw error
      if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
        const detail = 'error' in data ? String(data.error) : 'El proveedor rechazó el envío'
        throw new Error(detail)
      }
      const provider = data && typeof data === 'object' && 'provider' in data ? String(data.provider) : ''
      const providerStatus = data && typeof data === 'object' && 'status' in data ? String(data.status).toLowerCase() : ''
      if (provider === 'sunat_direct' || providerStatus === 'accepted' || providerStatus === 'aceptado') {
        await fetch(`/api/invoices/${encodeURIComponent(job.entityId)}/sync-drive`, { method: 'POST' }).catch(() => undefined)
      }
      await db.integrationJobs.update(job.id, { status: 'done', lastError: null, updatedAt: Date.now() })
    } catch (error) {
      const attemptCount = job.attemptCount + 1
      await db.integrationJobs.update(job.id, {
        status: attemptCount >= 8 ? 'blocked' : 'retry',
        attemptCount,
        nextAttemptAt: Date.now() + Math.min(60_000 * 2 ** Math.min(attemptCount, 5), 30 * 60_000),
        lastError: error instanceof Error ? error.message : 'Error de emisión',
        updatedAt: Date.now(),
      })
    }
  }
}
