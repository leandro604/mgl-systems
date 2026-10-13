'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ClipboardCheck, GraduationCap, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import type { LocalSstRecord } from '@/lib/db/schema'
import type { DocumentRow, SstRecordRow } from '@/types/domain'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import { createSstRecordLocal, setSstDeletedLocal } from './repository'
import { useSyncStore } from '@/stores/sync-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { projectId: string; initialRecords: SstRecordRow[]; documents: Pick<DocumentRow, 'id' | 'name'>[] }

const typeMeta = {
  inspection: { label: 'Inspección', icon: ClipboardCheck },
  incident: { label: 'Incidente', icon: AlertTriangle },
  training: { label: 'Capacitación', icon: GraduationCap },
  permit: { label: 'Permiso', icon: ShieldCheck },
} as const

function localRecord(row: SstRecordRow): LocalSstRecord { return { ...row, pending_sync: false, sync_error: null, local_updated_at: row.updated_at } }

export function ProjectSstPanel({ projectId, initialRecords, documents }: Props) {
  const [records,setRecords]=useState<LocalSstRecord[]>(()=>initialRecords.map(localRecord))
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [open,setOpen]=useState(false)
  const lastSyncedAt=useSyncStore((state)=>state.lastSyncedAt)

  const refresh=useCallback(async()=>{const{db}=await resolveOperationalRuntime();const rows=await db.sstRecords.where('project_id').equals(projectId).toArray();if(rows.length>0||initialRecords.length===0)setRecords(rows.filter((row)=>row.deleted_at===null).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at)))},[projectId,initialRecords.length])
  useEffect(()=>{void refresh()},[refresh,lastSyncedAt])

  async function createRecord(formData:FormData){setBusy(true);setMessage('');try{const{db,identity}=await resolveOperationalRuntime();const localDate=String(formData.get('occurred_at')??'');await createSstRecordLocal(db,identity,projectId,{record_type:String(formData.get('record_type')??'inspection'),title:String(formData.get('title')??''),occurred_at:localDate?new Date(localDate).toISOString():new Date().toISOString(),details:{notes:String(formData.get('notes')??'')},document_id:String(formData.get('document_id')??'')||null});setMessage(navigator.onLine?'Registro SST guardado':'Guardado sin conexión');setOpen(false);await refresh()}catch(error){setMessage(error instanceof Error?error.message:'No se pudo registrar SST.')}finally{setBusy(false)}}
  async function archiveRecord(id:string){setBusy(true);setMessage('');try{const{db,identity}=await resolveOperationalRuntime();await setSstDeletedLocal(db,identity,id,true);await refresh()}catch(error){setMessage(error instanceof Error?error.message:'No se pudo archivar el registro.')}finally{setBusy(false)}}

  return <div className="space-y-8">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-medium tracking-tight text-slate-950">SST</h2><p className="mt-1 text-xs text-slate-400">{records.length} registros activos</p></div><Button onClick={()=>setOpen(true)}><Plus/>Nuevo registro</Button></div>
    {message?<p className="text-sm text-slate-600">{message}</p>:null}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {records.map((record)=>{const meta=typeMeta[record.record_type as keyof typeof typeMeta]??typeMeta.inspection;const Icon=meta.icon;const details=typeof record.details==='object'&&record.details&&!Array.isArray(record.details)?record.details as Record<string,unknown>:{};return <div key={record.id} className="flex items-start gap-3 px-6 py-3 hover:bg-slate-50"><Icon className="mt-0.5 size-5 shrink-0 text-slate-400"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-900">{record.title}</p><Badge variant="neutral">{meta.label}</Badge>{record.pending_sync?<Badge variant="warning">Local</Badge>:null}</div><p className="mt-1 text-xs text-slate-400">{new Date(record.occurred_at).toLocaleString()}</p>{typeof details.notes==='string'&&details.notes?<p className="mt-1 line-clamp-2 text-sm text-slate-600">{details.notes}</p>:null}</div><Button type="button" size="icon" variant="ghost" disabled={busy} onClick={()=>void archiveRecord(record.id)} title="Archivar"><Trash2/></Button></div>})}
        {!records.length?<div className="px-6 py-10 text-center text-sm text-slate-400">Sin registros SST</div>:null}
      </div>
    </section>
    <Drawer open={open} onOpenChange={setOpen} title="Nuevo registro SST">
      <form action={createRecord} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="sst-title">Título</Label><Input id="sst-title" name="title" required maxLength={250} placeholder="Título"/></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Tipo<select name="record_type" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm"><option value="inspection">Inspección</option><option value="incident">Incidente</option><option value="training">Capacitación</option><option value="permit">Permiso</option></select></label><div className="space-y-2"><Label htmlFor="occurred_at">Fecha y hora</Label><Input id="occurred_at" name="occurred_at" type="datetime-local" required/></div></div>
        <div className="space-y-2"><Label htmlFor="sst-notes">Detalle</Label><textarea id="sst-notes" name="notes" rows={5} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"/></div>
        <label className="text-sm font-medium text-slate-700">Documento relacionado<select name="document_id" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm"><option value="">Sin documento</option>{documents.map((document)=><option key={document.id} value={document.id}>{document.name}</option>)}</select></label>
        <Button type="submit" disabled={busy} className="w-full"><ShieldCheck/>{busy?'Guardando…':'Crear registro'}</Button>
      </form>
    </Drawer>
  </div>
}
