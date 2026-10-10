'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Json } from '@/lib/supabase/database.types'
import { requireWorkspaceContext } from '@/features/auth/server'
import { createFolder, getDriveItem, listDriveItems, revokeProviderConnection, stopWatch, watchFolder } from './drive.service'
import { importDriveStructure, syncProjectDriveLink } from './drive-structure-importer'
import { normalizeStageFolderMap } from './drive-utils'
import { createDriveWatchToken } from './watch-token'
import type { DriveProvider, StageFolderMap } from './types'

export type DriveActionState = { status: 'idle' | 'success' | 'error'; message: string }

const legacyImportSchema = z.object({ provider: z.enum(['google','microsoft']), project_id: z.string().uuid(), root_folder_id: z.string().min(1).max(500) })
const bindSchema = z.object({ provider: z.enum(['google','microsoft']), project_id: z.string().uuid(), root_folder_id: z.string().min(1).max(500) })
const linkSchema = z.object({ link_id: z.string().uuid() })
const disconnectSchema = z.object({ provider: z.enum(['google','microsoft']), cloud_account_id: z.string().uuid() })

function allowed(role: string) {
  return ['admin', 'pm', 'supervisor'].includes(role)
}

function refreshIntegrationPaths(projectId?: string) {
  revalidatePath('/app/configuracion/integraciones')
  revalidatePath('/app/documents')
  if (projectId) revalidatePath(`/app/projects/${projectId}/documents`)
}

function projectAvailable(projects: Array<{ id: string }>, projectId: string) {
  return projects.some((project) => project.id === projectId)
}

function safeFolderName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Etapa'
}

export async function bindProjectDriveAction(formData: FormData): Promise<void> {
  const parsed = bindSchema.safeParse({ provider: formData.get('provider'), project_id: formData.get('project_id'), root_folder_id: formData.get('root_folder_id') })
  if (!parsed.success) throw new Error('Selecciona proveedor, proyecto y carpeta raíz.')
  const ctx = await requireWorkspaceContext()
  if (!allowed(ctx.profile.role)) throw new Error('Sin acceso para modificar integraciones.')
  if (!projectAvailable(ctx.projects, parsed.data.project_id)) throw new Error('Proyecto no disponible.')

  const { data: account, error: accountError } = await ctx.supabase
    .from('cloud_accounts')
    .select('id,provider_account_id')
    .eq('user_id', ctx.userId)
    .eq('company_id', ctx.company.id)
    .eq('provider', parsed.data.provider)
    .is('deleted_at', null)
    .maybeSingle()
  if (accountError) throw accountError
  if (!account) throw new Error('Primero conecta la cuenta del proveedor.')

  const folder = await getDriveItem(parsed.data.provider, parsed.data.root_folder_id, { cloudAccountId: account.id })
  if (!folder.isFolder) throw new Error('El elemento seleccionado no es una carpeta.')
  const { data: existingLink, error: existingLinkError } = await ctx.supabase
    .from('project_cloud_drives')
    .select('root_folder_id,cloud_account_id,stage_folder_map')
    .eq('company_id', ctx.company.id)
    .eq('project_id', parsed.data.project_id)
    .eq('provider', parsed.data.provider)
    .is('deleted_at', null)
    .maybeSingle()
  if (existingLinkError) throw existingLinkError
  const preserveStageMap = existingLink?.root_folder_id === folder.id && existingLink.cloud_account_id === account.id
  const now = new Date().toISOString()
  const row = {
    company_id: ctx.company.id,
    project_id: parsed.data.project_id,
    provider: parsed.data.provider,
    cloud_account_id: account.id,
    provider_account_id: account.provider_account_id,
    root_folder_id: folder.id,
    root_folder_name: folder.name || 'Raíz',
    root_folder_url: folder.webUrl,
    sync_enabled: false,
    sync_status: 'idle' as const,
    sync_error: null,
    stage_folder_map: preserveStageMap ? existingLink?.stage_folder_map ?? ({} as Json) : ({} as Json),
    created_by: ctx.userId,
    deleted_at: null,
    updated_at: now,
    mutation_id: crypto.randomUUID(),
  }
  const { error } = await ctx.supabase
    .from('project_cloud_drives')
    .upsert(row, { onConflict: 'company_id,project_id,provider' })
  if (error) throw error

  // Tarea 14 original usaba userId como provider_account_id. Normalizamos esos
  // registros al ID real de la cuenta para evitar duplicar el mismo archivo al resincronizar.
  if (account.provider_account_id && account.provider_account_id !== ctx.userId) {
    const legacyProvider = parsed.data.provider === 'google' ? 'google_drive' : 'onedrive'
    const { error: normalizeError } = await ctx.supabase
      .from('documents')
      .update({ provider_account_id: account.provider_account_id, updated_at: now, mutation_id: crypto.randomUUID() })
      .eq('project_id', parsed.data.project_id)
      .eq('provider', legacyProvider)
      .eq('provider_account_id', ctx.userId)
    if (normalizeError && normalizeError.code !== '23505') throw normalizeError
  }
  refreshIntegrationPaths(parsed.data.project_id)
}

export async function createProjectDriveStructureAction(formData: FormData): Promise<void> {
  const parsed = linkSchema.safeParse({ link_id: formData.get('link_id') })
  if (!parsed.success) throw new Error('Vinculación inválida.')
  const ctx = await requireWorkspaceContext()
  if (!allowed(ctx.profile.role)) throw new Error('Sin acceso.')

  const { data: link, error: linkError } = await ctx.supabase
    .from('project_cloud_drives')
    .select('*')
    .eq('id', parsed.data.link_id)
    .eq('created_by', ctx.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (linkError) throw linkError
  if (!link) throw new Error('Solo quien vinculó la cuenta puede modificar su estructura.')

  const { data: stages, error: stageError } = await ctx.supabase
    .from('project_stages')
    .select('id,code,name,sort_order')
    .eq('project_id', link.project_id)
    .is('deleted_at', null)
    .order('sort_order')
  if (stageError) throw stageError

  const currentMap = normalizeStageFolderMap(link.stage_folder_map)
  const children = await listDriveItems(link.provider as DriveProvider, link.root_folder_id, { cloudAccountId: link.cloud_account_id })
  const folders = children.filter((item) => item.isFolder)
  const nextMap: StageFolderMap = { ...currentMap }

  for (const stage of stages ?? []) {
    const codePrefix = `${stage.code}_`.toUpperCase()
    const existingMapped = nextMap[stage.id]
    const existing = existingMapped
      ? folders.find((item) => item.id === existingMapped.id)
      : folders.find((item) => item.name.toUpperCase().startsWith(codePrefix) || item.name === stage.name)
    const folder = existing ?? await createFolder(link.provider as DriveProvider, safeFolderName(stage.name), link.root_folder_id, { cloudAccountId: link.cloud_account_id })
    nextMap[stage.id] = { id: folder.id, name: folder.name, path: `/${folder.name}` }
    if (!folders.some((item) => item.id === folder.id)) folders.push(folder)
  }

  const { error } = await ctx.supabase
    .from('project_cloud_drives')
    .update({ stage_folder_map: nextMap as unknown as Json, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() })
    .eq('id', link.id)
  if (error) throw error
  refreshIntegrationPaths(link.project_id)
}

export async function syncProjectDriveAction(formData: FormData): Promise<void> {
  const parsed = linkSchema.safeParse({ link_id: formData.get('link_id') })
  if (!parsed.success) throw new Error('Vinculación inválida.')
  const ctx = await requireWorkspaceContext()
  if (!allowed(ctx.profile.role)) throw new Error('Sin acceso.')
  const { data: link, error } = await ctx.supabase
    .from('project_cloud_drives')
    .select('project_id,created_by')
    .eq('id', parsed.data.link_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!link) throw new Error('Vinculación no disponible.')
  if (link.created_by !== ctx.userId) throw new Error('La sincronización debe ejecutarla quien conectó esta cuenta.')
  await syncProjectDriveLink(parsed.data.link_id)
  refreshIntegrationPaths(link.project_id)
}

export async function enableProjectDriveWatchAction(formData: FormData): Promise<void> {
  const parsed = linkSchema.safeParse({ link_id: formData.get('link_id') })
  if (!parsed.success) throw new Error('Vinculación inválida.')
  const ctx = await requireWorkspaceContext()
  if (!allowed(ctx.profile.role)) throw new Error('Sin acceso.')
  const { data: link, error } = await ctx.supabase
    .from('project_cloud_drives')
    .select('*')
    .eq('id', parsed.data.link_id)
    .eq('created_by', ctx.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!link) throw new Error('Solo quien vinculó la cuenta puede activar la sincronización automática.')

  const baseUrl = (process.env.MGL_APP_URL ?? '').replace(/\/$/, '')
  if (!/^https:\/\//.test(baseUrl)) throw new Error('MGL_APP_URL debe ser una URL pública HTTPS para registrar webhooks.')
  const notificationUrl = `${baseUrl}/api/drive/webhook/${link.provider}`

  if (link.watch_channel_id) {
    await stopWatch(link.provider as DriveProvider, {
      cloudAccountId: link.cloud_account_id,
      channelId: link.watch_channel_id,
      resourceId: link.watch_resource_id,
    }).catch(() => undefined)
  }

  const registration = await watchFolder(link.provider as DriveProvider, link.root_folder_id, notificationUrl, {
    cloudAccountId: link.cloud_account_id,
    channelToken: createDriveWatchToken(link.id),
  })
  const { error: updateError } = await ctx.supabase
    .from('project_cloud_drives')
    .update({
      sync_enabled: true,
      watch_channel_id: registration.channelId,
      watch_resource_id: registration.resourceId,
      watch_expires_at: registration.expiresAt,
      delta_cursor: registration.cursor,
      sync_error: null,
      updated_at: new Date().toISOString(),
      mutation_id: crypto.randomUUID(),
    })
    .eq('id', link.id)
  if (updateError) throw updateError
  refreshIntegrationPaths(link.project_id)
}

export async function unlinkProjectDriveAction(formData: FormData): Promise<void> {
  const parsed = linkSchema.safeParse({ link_id: formData.get('link_id') })
  if (!parsed.success) throw new Error('Vinculación inválida.')
  const ctx = await requireWorkspaceContext()
  if (!allowed(ctx.profile.role)) throw new Error('Sin acceso.')
  const { data: link, error } = await ctx.supabase
    .from('project_cloud_drives')
    .select('*')
    .eq('id', parsed.data.link_id)
    .eq('created_by', ctx.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!link) throw new Error('Solo quien vinculó la cuenta puede desvincularla.')

  if (link.watch_channel_id) {
    await stopWatch(link.provider as DriveProvider, {
      cloudAccountId: link.cloud_account_id,
      channelId: link.watch_channel_id,
      resourceId: link.watch_resource_id,
    }).catch(() => undefined)
  }
  const { error: deleteError } = await ctx.supabase.from('project_cloud_drives').delete().eq('id', link.id)
  if (deleteError) throw deleteError
  refreshIntegrationPaths(link.project_id)
}

export async function disconnectCloudAccountAction(formData: FormData): Promise<void> {
  const parsed = disconnectSchema.safeParse({ provider: formData.get('provider'), cloud_account_id: formData.get('cloud_account_id') })
  if (!parsed.success) throw new Error('Cuenta inválida.')
  const ctx = await requireWorkspaceContext()
  if (!allowed(ctx.profile.role)) throw new Error('Sin acceso.')
  const { data: account, error } = await ctx.supabase
    .from('cloud_accounts')
    .select('id')
    .eq('id', parsed.data.cloud_account_id)
    .eq('provider', parsed.data.provider)
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!account) throw new Error('Cuenta no disponible.')
  const { data: links, error: linksError } = await ctx.supabase
    .from('project_cloud_drives')
    .select('provider,cloud_account_id,watch_channel_id,watch_resource_id')
    .eq('cloud_account_id', account.id)
    .eq('created_by', ctx.userId)
    .is('deleted_at', null)
  if (linksError) throw linksError
  for (const link of links ?? []) {
    if (!link.watch_channel_id) continue
    await stopWatch(link.provider as DriveProvider, {
      cloudAccountId: link.cloud_account_id,
      channelId: link.watch_channel_id,
      resourceId: link.watch_resource_id,
    }).catch(() => undefined)
  }
  await revokeProviderConnection(parsed.data.provider, account.id)
  refreshIntegrationPaths()
}

export async function importDriveStructureAction(_state: DriveActionState, formData: FormData): Promise<DriveActionState> {
  const parsed = legacyImportSchema.safeParse({ provider: formData.get('provider'), project_id: formData.get('project_id'), root_folder_id: formData.get('root_folder_id') })
  if (!parsed.success) return { status: 'error', message: 'Revisa proyecto, proveedor y carpeta raíz.' }
  try {
    const ctx = await requireWorkspaceContext()
    if (!allowed(ctx.profile.role)) return { status: 'error', message: 'Sin acceso.' }
    if (!projectAvailable(ctx.projects, parsed.data.project_id)) return { status: 'error', message: 'Proyecto no disponible.' }
    const result = await importDriveStructure({ provider: parsed.data.provider, projectId: parsed.data.project_id, rootFolderId: parsed.data.root_folder_id, actorId: ctx.userId, companyId: ctx.company.id })
    refreshIntegrationPaths(parsed.data.project_id)
    return { status: 'success', message: `${result.imported} importados · ${result.skipped} omitidos · ${result.archived} archivados` }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo importar.' }
  }
}
