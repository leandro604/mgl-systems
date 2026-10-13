'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { liveQuery } from 'dexie'
import { ExternalLink, FilePlus2, FileText, Folder, List, X } from 'lucide-react'
import type { LocalDocument } from '@/lib/db/schema'
import type { DocumentRow } from '@/types/domain'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import { createDocumentMetadataLocal, setDocumentDeletedLocal } from './repository'
import { buildDocumentTree, documentType, emptyDocumentFilters, filterDocuments, type DocumentFolder, type DocumentFilters } from './document-search'
import { stageLabel, type TaskStageOption } from '@/features/tasks/task6-kanban'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'

type Props = { projectId: string; projectName: string; initialDocuments: DocumentRow[]; stages: (TaskStageOption & { project_id?: string })[]; projects?: { id: string; name: string }[]; members: { user_id: string; full_name: string }[]; initialSelectedId?: string }
const selectClass = 'h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700'
function localDocument(row: DocumentRow): LocalDocument {
  const { search_vector: _searchVector, ...document } = row
  return {
    ...document,
    stage_id: row.stage_id ?? null,
    description: row.description ?? '',
    folder_path: row.folder_path ?? '/',
    version: row.version ?? 1,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  }
}
function FolderTree({ node, renderRow }: { node: DocumentFolder; renderRow: (row: LocalDocument) => React.ReactNode }) {
  return <div className="space-y-1">{node.folders.map((folder) => <details key={folder.path} open className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium text-slate-700"><Folder className="mr-2 inline size-4" />{folder.name}</summary><div className="mt-2 border-l border-slate-200 pl-3"><FolderTree node={folder} renderRow={renderRow} /></div></details>)}{node.documents.map(renderRow)}</div>
}

export function ProjectDocumentsPanel({ projectId, projectName, initialDocuments, stages, members, projects, initialSelectedId }: Props) {
  const [documents, setDocuments] = useState<LocalDocument[]>(() => initialDocuments.map(localDocument))
  const [filters, setFilters] = useState<DocumentFilters>({ ...emptyDocumentFilters, project: projectId })
  const projectOptions = useMemo(() => projects ?? [{ id: projectId, name: projectName }], [projects, projectId, projectName])
  const [creationProject, setCreationProject] = useState(projectId)
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const createDialog = useRef<HTMLDialogElement>(null)
  const detailDialog = useRef<HTMLDialogElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const selected = documents.find((row) => row.id === selectedId)
  const authors = useMemo(() => Object.fromEntries(members.map((member) => [member.user_id, member.full_name])), [members])
  const authorIds = [...new Set(documents.map((row) => row.uploaded_by))]
  const filtered = useMemo(() => filterDocuments(documents, filters, authors), [documents, filters, authors])
  const trees = useMemo(() => projectOptions.map((project) => ({ project, tree: buildDocumentTree(filtered.filter((row) => row.project_id === project.id)) })).filter(({ tree }) => tree.documents.length || tree.folders.length), [filtered, projectOptions])
  function change(key: keyof DocumentFilters, value: string) { setFilters((current) => ({ ...current, [key]: value })) }

  useEffect(() => {
    let disposed = false
    let subscription: { unsubscribe: () => void } | undefined
    void (async () => {
      const { db } = await resolveOperationalRuntime()
      // Seed only absent rows. Local pending edits and tombstones always win over the server-rendered snapshot.
      await db.transaction('rw', db.documents, async () => {
        for (const row of initialDocuments) if (!(await db.documents.get(row.id))) await db.documents.put(localDocument(row))
      })
      if (disposed) return
      subscription = liveQuery(() => db.documents.where('project_id').anyOf(projectOptions.map((project) => project.id)).toArray()).subscribe({
        next: (rows) => { setDocuments(rows.filter((row) => !row.deleted_at)); setReady(true) },
        error: () => setMessage('No se pudo leer la biblioteca local. Recarga la página para reintentar.'),
      })
    })().catch((error: unknown) => { if (!disposed) setMessage(error instanceof Error ? error.message : 'No se pudo abrir la biblioteca local.') })
    return () => { disposed = true; subscription?.unsubscribe() }
  }, [projectId, initialDocuments, projectOptions])

  useEffect(() => {
    if (selected) detailDialog.current?.showModal()
    else detailDialog.current?.close()
  }, [selected])

  async function createDocument(data: FormData) {
    setBusy(true); setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      const stageId = String(data.get('stage_id') ?? '')
      if (!projectOptions.some((project) => project.id === creationProject)) throw new Error('Selecciona un proyecto.')
      if (!stages.some((stage) => stage.id === stageId && !stage.is_locked && (!stage.project_id || stage.project_id === creationProject))) throw new Error('Selecciona una etapa disponible.')
      await createDocumentMetadataLocal(db, identity, creationProject, {
        name: String(data.get('name') ?? ''), stage_id: stageId,
        description: String(data.get('description') ?? ''), folder_path: String(data.get('folder_path') ?? '/'),
        provider: String(data.get('provider') ?? 'google_drive'), provider_account_id: 'manual-link',
        external_file_id: String(data.get('external_file_id') ?? ''), web_url: String(data.get('web_url') ?? ''),
        mime_type: String(data.get('mime_type') ?? 'application/pdf'), size_bytes: Number(data.get('size_bytes') ?? 0), sha256: null,
      })
      form.current?.reset(); createDialog.current?.close()
      setMessage('Documento guardado')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar el documento.') }
    finally { setBusy(false) }
  }
  async function archiveDocument(row: LocalDocument) {
    setBusy(true); setMessage('')
    try {
      if (stages.find((stage) => stage.id === row.stage_id)?.is_locked) throw new Error('Esta etapa está cerrada.')
      const { db, identity } = await resolveOperationalRuntime()
      await setDocumentDeletedLocal(db, identity, row.id, true)
      setSelectedId(null); setMessage('Documento archivado')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo archivar.') }
    finally { setBusy(false) }
  }
  function syncBadge(row: LocalDocument) { return <Badge>{row.sync_error ? 'Error de sincronización' : row.pending_sync ? 'Pendiente de sincronizar' : 'Sincronizado'}</Badge> }
  function renderRow(row: LocalDocument) {
    const stage = stages.find((item) => item.id === row.stage_id)
    return <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-2 py-4 text-left hover:bg-slate-50 focus-visible:outline-blue-600"><FileText className="size-5 shrink-0 text-slate-400" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{row.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{projectOptions.find((project) => project.id === row.project_id)?.name} · {stage ? stageLabel(stage) : 'Sin etapa'} · {row.folder_path || '/'} · {authors[row.uploaded_by] ?? 'Autor no disponible'}</span></span><span className="hidden text-xs text-slate-500 sm:block">{documentType(row.mime_type)} · {new Date(row.created_at).toLocaleDateString('es-PE')}</span>{syncBadge(row)}</button>
  }
  const activeFilters = (['stage', 'type', 'author', 'from', 'to'] as const).filter((key) => filters[key])
  const filterNames = { stage: 'Etapa', type: 'Tipo', author: 'Autor', from: 'Desde', to: 'Hasta' }
  return <div className="space-y-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Documentos</h1></div><Button disabled={!ready} onClick={() => { setMessage(''); createDialog.current?.showModal() }}><FilePlus2 className="size-4" />Registrar documento</Button></header>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Buscar y filtrar documentos">
      <SearchInput value={filters.query} onChange={(event) => change('query', event.target.value)} onClear={() => change('query', '')} aria-label="Buscar documentos" placeholder="Buscar documentos" className="h-14 text-base" />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-slate-500">Proyecto<select className={selectClass} value={filters.project} disabled={!!projectId} onChange={(event) => { change('project', event.target.value); change('stage', '') }}><option value="">Todos los proyectos</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-slate-500">Etapa<select className={selectClass} value={filters.stage} onChange={(event) => change('stage', event.target.value)}><option value="">Todas las etapas</option>{stages.filter((stage) => !filters.project || !stage.project_id || stage.project_id === filters.project).map((stage) => <option key={stage.id} value={stage.id}>{stageLabel(stage)}{!filters.project ? ` · ${projectOptions.find((project) => project.id === stage.project_id)?.name ?? ''}` : ''}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-slate-500">Tipo<select className={selectClass} value={filters.type} onChange={(event) => change('type', event.target.value)}><option value="">Todos los tipos</option>{['PDF', 'Excel', 'Texto', 'Imagen', 'Otro'].map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-slate-500">Autor<select className={selectClass} value={filters.author} onChange={(event) => change('author', event.target.value)}><option value="">Todos los autores</option>{authorIds.map((id) => <option key={id} value={id}>{authors[id] ?? `Autor ${id.slice(0, 8)}`}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-slate-500">Desde<Input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => change('from', event.target.value)} /></label>
        <label className="grid gap-1 text-xs text-slate-500">Hasta<Input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => change('to', event.target.value)} /></label>
      </div>
      {(activeFilters.length > 0 || (!projectId && filters.project)) && <div className="flex flex-wrap gap-2">{!projectId && filters.project && <Chip selected removable onRemove={() => { change('project', ''); change('stage', '') }}>Proyecto: {projectOptions.find((project) => project.id === filters.project)?.name}</Chip>}{activeFilters.map((key) => <Chip key={key} selected removable onRemove={() => change(key, '')}>{filterNames[key]}: {key === 'stage' ? stages.find((stage) => stage.id === filters.stage)?.name : key === 'author' ? authors[filters.author] ?? filters.author.slice(0, 8) : filters[key]}</Chip>)}<Button variant="ghost" onClick={() => setFilters({ ...emptyDocumentFilters, project: projectId })}>Limpiar filtros</Button></div>}
    </section>
    {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500" aria-live="polite">{filtered.length} de {documents.length} documentos</p><div className="flex gap-2"><Button variant={view === 'list' ? 'default' : 'secondary'} aria-pressed={view === 'list'} onClick={() => setView('list')}><List className="size-4" />Lista</Button><Button variant={view === 'tree' ? 'default' : 'secondary'} aria-pressed={view === 'tree'} onClick={() => setView('tree')}><Folder className="size-4" />Carpetas</Button></div></div>
      {filtered.length ? view === 'tree' ? <div className="space-y-4">{trees.map(({ project, tree }) => <div key={project.id}>{!projectId && <h3 className="mb-2 text-sm font-medium text-slate-700">{project.name}</h3>}<FolderTree node={tree} renderRow={renderRow} /></div>)}</div> : filtered.map(renderRow) : <div className="py-12 text-center"><FileText className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm text-slate-600">{documents.length ? 'Sin resultados' : 'Sin documentos'}</p></div>}
    </section>
    <dialog ref={createDialog} aria-labelledby="new-document-title" className="m-auto max-h-[90dvh] w-[min(40rem,94vw)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm backdrop:bg-slate-950/30">
      <div className="mb-4 flex items-center justify-between"><h2 id="new-document-title" className="text-lg font-medium tracking-tight">Registrar documento</h2><Button variant="ghost" size="icon" aria-label="Cerrar formulario" onClick={() => createDialog.current?.close()}><X /></Button></div>
      
      <form ref={form} onSubmit={(event) => { event.preventDefault(); if (!busy) void createDocument(new FormData(event.currentTarget)) }} className="space-y-4">
        <label className="grid gap-2 text-sm">Proyecto *<select className={selectClass} required value={creationProject} disabled={!!projectId} onChange={(event) => setCreationProject(event.target.value)}><option value="" disabled>Seleccionar proyecto</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Nombre<Input name="name" required maxLength={255} placeholder="Nombre" /></label>
        <label className="grid gap-2 text-sm">Etapa *<select key={creationProject} name="stage_id" required defaultValue="" className={selectClass}><option value="" disabled>Seleccionar etapa</option>{stages.filter((stage) => !stage.project_id || stage.project_id === creationProject).map((stage) => <option key={stage.id} value={stage.id} disabled={stage.is_locked}>{stageLabel(stage)}{stage.is_locked ? ' (cerrada)' : ''}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Descripción<textarea name="description" maxLength={20000} rows={3} className="rounded-lg border border-slate-200 p-3 text-sm" /></label>
        <label className="grid gap-2 text-sm">Ruta de carpeta<Input name="folder_path" defaultValue="/" maxLength={2000} placeholder="/Carpeta" /></label>
        <label className="grid gap-2 text-sm">Enlace HTTPS<Input name="web_url" type="url" required placeholder="https://drive.google.com/..." /></label>
        <label className="grid gap-2 text-sm">ID del archivo en el proveedor<Input name="external_file_id" required maxLength={1000} placeholder="Archivo ID" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm">Proveedor<select name="provider" className={selectClass}><option value="google_drive">Google Drive</option><option value="onedrive">OneDrive</option></select></label><label className="grid gap-2 text-sm">Tipo<select name="mime_type" className={selectClass}><option value="application/pdf">PDF</option><option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">Excel</option><option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word</option><option value="image/jpeg">Imagen JPEG</option><option value="application/octet-stream">Otro</option></select></label></div>
        <label className="grid gap-2 text-sm">Tamaño en bytes<Input name="size_bytes" type="number" min="0" step="1" defaultValue="0" /></label>
        {message && <p role="status" className="text-sm text-slate-600">{message}</p>}<Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar referencia'}</Button>
      </form>
    </dialog>
    <dialog ref={detailDialog} onClose={() => setSelectedId(null)} aria-labelledby="document-detail-title" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-[min(30rem,100vw)] max-w-full overflow-y-auto border-l border-slate-200 bg-white p-6 text-slate-900 shadow-sm backdrop:bg-slate-950/30">
      {selected && <><div className="flex items-start justify-between gap-3"><h2 id="document-detail-title" className="break-words text-lg font-medium tracking-tight">{selected.name}</h2><Button variant="ghost" size="icon" aria-label="Cerrar detalles" onClick={() => detailDialog.current?.close()}><X /></Button></div><div className="mt-4">{syncBadge(selected)}</div>{selected.sync_error && <p className="mt-3 text-sm text-red-600">{selected.sync_error}</p>}<p className="mt-6 whitespace-pre-wrap text-sm text-slate-600">{selected.description || 'Sin descripción.'}</p><dl className="my-6 space-y-4 text-sm">{[['Proyecto', projectOptions.find((project) => project.id === selected.project_id)?.name ?? projectName], ['Etapa', stages.find((stage) => stage.id === selected.stage_id)?.name ?? 'Sin etapa'], ['Carpeta', selected.folder_path || '/'], ['Proveedor', selected.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'], ['ID del archivo', selected.external_file_id], ['Tipo', documentType(selected.mime_type)], ['Tamaño', `${selected.size_bytes.toLocaleString('es-PE')} bytes`], ['Autor', authors[selected.uploaded_by] ?? 'Autor no disponible'], ['Registrado', new Date(selected.created_at).toLocaleString('es-PE')]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-slate-700">{value}</dd></div>)}</dl><div className="flex flex-wrap gap-3">{selected.web_url.startsWith('https://') && <Button asChild><a href={selected.web_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Abrir archivo</a></Button>}<Button variant="secondary" disabled={busy || !ready || stages.some((stage) => stage.id === selected.stage_id && stage.is_locked)} onClick={() => void archiveDocument(selected)}>Archivar</Button></div></>}
    </dialog>
  </div>
}
