'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ClipboardCheck, GraduationCap, ShieldCheck, Trash2 } from 'lucide-react'
import type { LocalSstRecord } from '@/lib/db/schema'
import type { DocumentRow, SstRecordRow } from '@/types/domain'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import { createSstRecordLocal, setSstDeletedLocal } from './repository'
import { useSyncStore } from '@/stores/sync-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { projectId: string; initialRecords: SstRecordRow[]; documents: Pick<DocumentRow, 'id' | 'name'>[] }

const typeMeta = {
  inspection: { label: 'Inspección', icon: ClipboardCheck },
  incident: { label: 'Incidente', icon: AlertTriangle },
  training: { label: 'Capacitación', icon: GraduationCap },
  permit: { label: 'Permiso', icon: ShieldCheck },
} as const

function localRecord(row: SstRecordRow): LocalSstRecord {
  return { ...row, pending_sync: false, sync_error: null, local_updated_at: row.updated_at }
}

export function ProjectSstPanel({ projectId, initialRecords, documents }: Props) {
  const [records, setRecords] = useState<LocalSstRecord[]>(() => initialRecords.map(localRecord))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)

  const refresh = useCallback(async () => {
    const { db } = await resolveOperationalRuntime()
    const rows = await db.sstRecords.where('project_id').equals(projectId).toArray()
    if (rows.length > 0 || initialRecords.length === 0) setRecords(rows.filter((row) => row.deleted_at === null).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)))
  }, [projectId, initialRecords.length])

  useEffect(() => { void refresh() }, [refresh, lastSyncedAt])

  async function createRecord(formData: FormData) {
    setBusy(true); setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      const localDate = String(formData.get('occurred_at') ?? '')
      const occurredAt = localDate ? new Date(localDate).toISOString() : new Date().toISOString()
      await createSstRecordLocal(db, identity, projectId, {
        record_type: String(formData.get('record_type') ?? 'inspection'),
        title: String(formData.get('title') ?? ''),
        occurred_at: occurredAt,
        details: { notes: String(formData.get('notes') ?? '') },
        document_id: String(formData.get('document_id') ?? '') || null,
      })
      setMessage(navigator.onLine ? 'Registro SST creado y enviado a sincronización.' : 'Registro SST guardado sin conexión.')
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar SST.') }
    finally { setBusy(false) }
  }

  async function archiveRecord(id: string) {
    setBusy(true); setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      await setSstDeletedLocal(db, identity, id, true)
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo archivar el registro.') }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <form action={createRecord} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div><h2 className="flex items-center gap-2 font-semibold text-white"><ShieldCheck className="size-4 text-cyan-300" />Nuevo registro SST</h2><p className="mt-1 text-sm text-slate-500">Inspecciones, incidentes, capacitaciones y permisos quedan disponibles offline.</p></div>
        <div className="space-y-2"><Label htmlFor="sst-title">Título</Label><Input id="sst-title" name="title" required maxLength={250} placeholder="Ej. Inspección de bandejas en piso 3" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-400">Tipo<select name="record_type" className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100"><option value="inspection">Inspección</option><option value="incident">Incidente</option><option value="training">Capacitación</option><option value="permit">Permiso</option></select></label>
          <div className="space-y-2"><Label htmlFor="occurred_at">Fecha y hora</Label><Input id="occurred_at" name="occurred_at" type="datetime-local" required /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="sst-notes">Detalle / observación</Label><textarea id="sst-notes" name="notes" rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400/70" /></div>
        <label className="text-xs font-semibold text-slate-400">Documento relacionado<select name="document_id" className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100"><option value="">Sin documento</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label>
        <Button type="submit" disabled={busy}><ShieldCheck />{busy ? 'Guardando…' : 'Crear registro'}</Button>
        {message ? <p className="text-sm text-slate-400">{message}</p> : null}
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div><h2 className="font-semibold text-white">Historial SST</h2><p className="mt-1 text-sm text-slate-500">{records.length} registro(s) activo(s).</p></div>
        <div className="mt-5 space-y-3">
          {records.map((record) => {
            const meta = typeMeta[record.record_type as keyof typeof typeMeta] ?? typeMeta.inspection
            const Icon = meta.icon
            const details = typeof record.details === 'object' && record.details && !Array.isArray(record.details) ? record.details as Record<string, unknown> : {}
            return <article key={record.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-100">{record.title}</h3><Badge>{meta.label}</Badge>{record.pending_sync ? <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">Local</Badge> : null}</div><p className="mt-1 text-xs text-slate-500">{new Date(record.occurred_at).toLocaleString()}</p>{typeof details.notes === 'string' && details.notes ? <p className="mt-3 text-sm leading-6 text-slate-400">{details.notes}</p> : null}</div><Button type="button" size="icon" variant="ghost" disabled={busy} onClick={() => void archiveRecord(record.id)} title="Archivar"><Trash2 /></Button></div></article>
          })}
          {records.length === 0 ? <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-600">Todavía no hay registros SST para este proyecto.</div> : null}
        </div>
      </section>
    </div>
  )
}
