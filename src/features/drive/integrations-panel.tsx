'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, ChevronRight, Cloud, ExternalLink, Folder, FolderOpen, FolderPlus, FolderSync, Link2, RefreshCcw, Unlink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  bindProjectDriveAction,
  createProjectDriveStructureAction,
  disconnectCloudAccountAction,
  enableProjectDriveWatchAction,
  syncProjectDriveAction,
  unlinkProjectDriveAction,
} from './actions'
import type { CloudAccountSummary, DriveItem, DriveProvider, ProjectCloudDrive } from './types'

type ProjectOption = { id: string; name: string }
type LinkView = ProjectCloudDrive & { projectName: string; ownerIsCurrentUser: boolean }

type Props = {
  projects: ProjectOption[]
  accounts: Partial<Record<DriveProvider, CloudAccountSummary>>
  links: LinkView[]
}

const selectClass = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800'

function providerLabel(provider: DriveProvider) {
  return provider === 'google' ? 'Google Drive' : 'OneDrive'
}

function formatDate(value: string | null) {
  if (!value) return 'Nunca'
  return new Date(value).toLocaleString('es-PE')
}

export function IntegrationsPanel({ projects, accounts, links }: Props) {
  const connectedProviders = (['google', 'microsoft'] as const).filter((provider) => Boolean(accounts[provider]))
  const [provider, setProvider] = useState<DriveProvider>(connectedProviders[0] ?? 'google')
  const [projectId, setProjectId] = useState('')
  const [folder, setFolder] = useState<DriveItem | null>(null)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function execute(action: (formData: FormData) => Promise<void>, values: Record<string, string>, success: string) {
    setMessage('')
    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData()
          for (const [key, value] of Object.entries(values)) formData.set(key, value)
          await action(formData)
          setMessage(success)
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.')
        }
      })()
    })
  }

  function bind() {
    if (!projectId || !folder) {
      setMessage('Selecciona un proyecto y una carpeta de Drive/OneDrive.')
      return
    }
    execute(bindProjectDriveAction, { provider, project_id: projectId, root_folder_id: folder.id }, 'Carpeta vinculada al proyecto.')
  }

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2">
      <ProviderCard provider="google" account={accounts.google} pending={pending} onDisconnect={(account) => execute(disconnectCloudAccountAction, { provider: 'google', cloud_account_id: account.id }, 'Google Drive desconectado.')} />
      <ProviderCard provider="microsoft" account={accounts.microsoft} pending={pending} onDisconnect={(account) => execute(disconnectCloudAccountAction, { provider: 'microsoft', cloud_account_id: account.id }, 'OneDrive desconectado.')} />
    </div>

    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-medium text-slate-950">Vincular carpeta a un proyecto</h2>
        <p className="mt-1 text-sm text-slate-500">Ya no necesitas copiar IDs. Explora tu unidad, selecciona una carpeta y MGL guardará el vínculo.</p>
      </div>
      {connectedProviders.length ? <div className="grid gap-4 lg:grid-cols-[0.8fr_1fr_1.4fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="drive-provider">Proveedor</Label>
          <select id="drive-provider" className={selectClass} value={provider} onChange={(event) => { setProvider(event.target.value as DriveProvider); setFolder(null) }}>
            {connectedProviders.map((item) => <option key={item} value={item}>{providerLabel(item)}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="drive-project">Proyecto</Label>
          <select id="drive-project" className={selectClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Seleccionar proyecto</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <FolderPicker provider={provider} selected={folder} onSelect={setFolder} />
        <Button type="button" disabled={pending || !projectId || !folder} onClick={bind}><Link2 className="size-4" />Vincular</Button>
      </div> : <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">Conecta Google Drive o OneDrive para comenzar.</div>}
      {message ? <p role="status" className={message.toLowerCase().includes('no se') || message.toLowerCase().includes('debe') ? 'text-sm text-red-700' : 'text-sm text-slate-600'}>{message}</p> : null}
    </section>

    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-medium text-slate-950">Carpetas vinculadas</h2>
        <p className="mt-1 text-sm text-slate-500">Crea las carpetas de etapas, sincroniza documentos y activa webhooks cuando tengas un dominio HTTPS público.</p>
      </div>
      {links.length ? <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {links.map((link) => <div key={link.id} className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{link.projectName}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{providerLabel(link.provider)}</span>{link.syncEnabled ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Automático</span> : null}</div>
              <p className="mt-1 truncate text-sm text-slate-600"><Folder className="mr-1 inline size-4" />{link.rootFolderName}</p>
              <p className="mt-1 text-xs text-slate-400">Última sincronización: {formatDate(link.lastSyncAt)} · Estado: {link.syncStatus}</p>
              {link.watchExpiresAt ? <p className="mt-1 text-xs text-slate-400">Webhook vence: {formatDate(link.watchExpiresAt)}</p> : null}
              {link.syncError ? <p className="mt-2 text-sm text-red-700">{link.syncError}</p> : null}
              {!link.ownerIsCurrentUser ? <p className="mt-2 text-xs text-amber-700">La cuenta fue vinculada por otro usuario. Solo esa persona puede modificar la conexión.</p> : null}
            </div>
            {link.rootFolderUrl ? <Button asChild variant="secondary" size="sm"><a href={link.rootFolderUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Abrir carpeta</a></Button> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={pending || !link.ownerIsCurrentUser} onClick={() => execute(createProjectDriveStructureAction, { link_id: link.id }, 'Estructura de etapas actualizada.')}><FolderPlus className="size-4" />Crear estructura</Button>
            <Button type="button" variant="secondary" size="sm" disabled={pending || !link.ownerIsCurrentUser} onClick={() => execute(syncProjectDriveAction, { link_id: link.id }, 'Sincronización completada.')}><FolderSync className="size-4" />Sincronizar ahora</Button>
            <Button type="button" variant="secondary" size="sm" disabled={pending || !link.ownerIsCurrentUser} onClick={() => execute(enableProjectDriveWatchAction, { link_id: link.id }, 'Sincronización automática activada.')}><RefreshCcw className="size-4" />{link.syncEnabled ? 'Renovar webhook' : 'Activar automático'}</Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending || !link.ownerIsCurrentUser} onClick={() => execute(unlinkProjectDriveAction, { link_id: link.id }, 'Carpeta desvinculada.')}><Unlink className="size-4" />Desvincular</Button>
          </div>
        </div>)}
      </div> : <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Sin carpetas vinculadas</div>}
    </section>
  </div>
}

function ProviderCard({ provider, account, pending, onDisconnect }: { provider: DriveProvider; account: CloudAccountSummary | undefined; pending: boolean; onDisconnect: (account: CloudAccountSummary) => void }) {
  const href = provider === 'google' ? '/api/oauth/google/start' : '/api/oauth/microsoft/start'
  return <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <Cloud className="mt-0.5 size-5 shrink-0 text-blue-600" />
        <div className="min-w-0">
          <p className="font-medium text-slate-950">{providerLabel(provider)}</p>
          {account ? <><p className="mt-1 truncate text-sm text-slate-700">{account.email ?? account.name ?? 'Cuenta conectada'}</p><p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="size-3" />Conectado · {new Date(account.connectedAt).toLocaleDateString('es-PE')}</p></> : <p className="mt-1 text-xs text-slate-500">Desconectado</p>}
        </div>
      </div>
      <Button asChild variant={account ? 'secondary' : 'default'} size="sm"><a href={href}>{account ? 'Reconectar' : 'Conectar'}</a></Button>
    </div>
    {account ? <div className="mt-4 border-t border-slate-100 pt-4"><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onDisconnect(account)}>Desconectar cuenta</Button></div> : null}
  </div>
}

function FolderPicker({ provider, selected, onSelect }: { provider: DriveProvider; selected: DriveItem | null; onSelect: (item: DriveItem) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [stack, setStack] = useState<Array<{ id: string; name: string }>>([{ id: 'root', name: provider === 'google' ? 'Mi unidad' : 'OneDrive' }])
  const [current, setCurrent] = useState<DriveItem | null>(null)
  const [folders, setFolders] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const currentId = stack[stack.length - 1]?.id ?? 'root'

  useEffect(() => {
    setStack([{ id: 'root', name: provider === 'google' ? 'Mi unidad' : 'OneDrive' }])
    setCurrent(null)
    setFolders([])
  }, [provider])

  async function load(parentId: string) {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/drive/folders?provider=${encodeURIComponent(provider)}&parentId=${encodeURIComponent(parentId)}`, { cache: 'no-store' })
      const payload = await response.json() as { current?: DriveItem; folders?: DriveItem[]; error?: string }
      if (!response.ok || !payload.current) throw new Error(payload.error ?? 'No se pudo abrir la carpeta.')
      setCurrent(payload.current)
      setFolders(payload.folders ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar Drive.')
    } finally { setLoading(false) }
  }

  function open() {
    dialog.current?.showModal()
    void load(currentId)
  }

  function enter(folder: DriveItem) {
    setStack((value) => [...value, { id: folder.id, name: folder.name }])
    void load(folder.id)
  }

  function goTo(index: number) {
    const next = stack.slice(0, index + 1)
    setStack(next)
    void load(next[next.length - 1]?.id ?? 'root')
  }

  return <div className="space-y-2">
    <Label>Carpeta raíz</Label>
    <Button type="button" variant="secondary" className="h-11 w-full justify-start overflow-hidden" onClick={open}><FolderOpen className="size-4 shrink-0" /><span className="truncate">{selected?.name ?? 'Elegir carpeta…'}</span></Button>
    <dialog ref={dialog} className="m-auto w-[min(44rem,94vw)] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/30">
      <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h3 className="font-medium">Seleccionar carpeta</h3><p className="text-xs text-slate-500">{providerLabel(provider)}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => dialog.current?.close()} aria-label="Cerrar"><X className="size-4" /></Button></div>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-5 py-3 text-sm">{stack.map((crumb, index) => <span key={`${crumb.id}-${index}`} className="flex items-center"><button type="button" className="rounded px-1.5 py-1 text-blue-700 hover:bg-blue-50" onClick={() => goTo(index)}>{crumb.name}</button>{index < stack.length - 1 ? <ChevronRight className="size-3 text-slate-400" /> : null}</span>)}</div>
      <div className="max-h-[50vh] min-h-56 overflow-y-auto p-3">
        {loading ? <p className="p-6 text-center text-sm text-slate-500">Cargando carpetas…</p> : error ? <p className="p-6 text-center text-sm text-red-700">{error}</p> : folders.length ? folders.map((item) => <button key={item.id} type="button" onClick={() => enter(item)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-slate-50"><Folder className="size-5 text-amber-500" /><span className="flex-1 truncate text-sm">{item.name}</span><ChevronRight className="size-4 text-slate-400" /></button>) : <p className="p-6 text-center text-sm text-slate-500">Esta carpeta no contiene subcarpetas.</p>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4"><p className="min-w-0 truncate text-sm text-slate-600">Actual: {current?.name ?? stack[stack.length - 1]?.name}</p><Button type="button" disabled={!current || loading} onClick={() => { if (current) onSelect(current); dialog.current?.close() }}>Usar esta carpeta</Button></div>
    </dialog>
  </div>
}
