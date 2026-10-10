'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CloudUpload, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DriveProvider, StageFolderMap } from './types'
import { uploadFileDirect } from './drive-client'

type Stage = { id: string; code: string; name: string; is_locked: boolean }
type Connection = {
  id: string
  provider: DriveProvider
  rootFolderId: string
  rootFolderName: string
  stageFolderMap: StageFolderMap
}

type Props = {
  projectId: string
  stages: Stage[]
  connections: Connection[]
}

function providerLabel(provider: DriveProvider) {
  return provider === 'google' ? 'Google Drive' : 'OneDrive'
}

export function CloudUploadPanel({ projectId, stages, connections }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? '')
  const [stageId, setStageId] = useState(stages.find((stage) => !stage.is_locked)?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const connection = useMemo(() => connections.find((item) => item.id === connectionId) ?? connections[0], [connections, connectionId])

  async function upload(files: FileList | null) {
    if (!files?.length || !connection || !stageId) return
    const stage = stages.find((item) => item.id === stageId)
    if (!stage || stage.is_locked) {
      setProgress('Selecciona una etapa disponible.')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setProgress('La subida a Drive/OneDrive requiere conexión a internet.')
      return
    }

    const mapped = connection.stageFolderMap[stageId]
    const parentId = mapped?.id ?? connection.rootFolderId
    const folderPath = mapped?.path ?? '/'
    setBusy(true)
    try {
      let completed = 0
      for (const file of Array.from(files)) {
        setProgress(`Subiendo ${completed + 1}/${files.length}: ${file.name}`)
        const item = await uploadFileDirect(connection.provider, file, parentId, connection.id)
        const register = await fetch('/api/drive/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            linkId: connection.id,
            projectId,
            stageId,
            folderPath,
            item: { id: item.id, name: item.name, mimeType: item.mimeType, size: item.size, webUrl: item.webUrl },
          }),
        })
        const payload = await register.json().catch(() => ({})) as { error?: string }
        if (!register.ok) throw new Error(payload.error ?? `No se pudo registrar ${file.name}`)
        completed += 1
      }
      setProgress(`${completed} archivo${completed === 1 ? '' : 's'} subido${completed === 1 ? '' : 's'} y registrado${completed === 1 ? '' : 's'}.`)
      if (input.current) input.current.value = ''
      window.setTimeout(() => window.location.reload(), 450)
    } catch (error) {
      setProgress(error instanceof Error ? error.message : 'No se pudo completar la subida.')
    } finally {
      setBusy(false)
    }
  }

  if (!connections.length) {
    return <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-slate-900">Subida directa a la nube</p><p className="mt-1 text-sm text-slate-500">Vincula una carpeta del proyecto para subir archivos sin copiar enlaces manualmente.</p></div><Button asChild variant="secondary"><Link href="/app/configuracion/integraciones">Configurar Drive/OneDrive</Link></Button></div>
    </section>
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="flex items-center gap-2 font-medium text-slate-900"><CloudUpload className="size-5 text-blue-600" />Subir a Drive / OneDrive</p><p className="mt-1 text-sm text-slate-500">El archivo se carga directamente al proveedor y MGL registra sus metadatos.</p></div>
      <input ref={input} type="file" multiple className="hidden" onChange={(event) => void upload(event.target.files)} />
      <Button type="button" disabled={busy || !stageId} onClick={() => input.current?.click()}><FileUp className="size-4" />{busy ? 'Subiendo…' : 'Seleccionar archivos'}</Button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs text-slate-500">Destino<select value={connection?.id ?? ''} onChange={(event) => setConnectionId(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">{connections.map((item) => <option key={item.id} value={item.id}>{providerLabel(item.provider)} · {item.rootFolderName}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Etapa<select value={stageId} onChange={(event) => setStageId(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"><option value="">Seleccionar etapa</option>{stages.map((stage) => <option key={stage.id} value={stage.id} disabled={stage.is_locked}>{stage.code} · {stage.name}{stage.is_locked ? ' (cerrada)' : ''}</option>)}</select></label>
    </div>
    {connection && stageId && !connection.stageFolderMap[stageId] ? <p className="mt-3 text-xs text-amber-700">Esta etapa todavía no tiene carpeta automática; los archivos se subirán a la raíz vinculada. Puedes crear la estructura desde Integraciones.</p> : null}
    {progress ? <p role="status" className="mt-3 text-sm text-slate-600">{progress}</p> : null}
  </section>
}
