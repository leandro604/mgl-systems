import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { getDriveAdminClient, listDriveItems } from './drive.service'
import type { DriveProvider, StageFolderMap } from './types'
import { normalizeStageFolderMap, stageCodeFromFolderName } from './drive-utils'
export { normalizeStageFolderMap, stageCodeFromFolderName } from './drive-utils'

const MAX_DEPTH = 12
const MAX_ITEMS = 5000

type ProjectDriveRow = Database['public']['Tables']['project_cloud_drives']['Row']
type ProjectStageRow = Pick<Database['public']['Tables']['project_stages']['Row'], 'id' | 'code' | 'name' | 'stage_type'>
function documentProvider(provider: DriveProvider) {
  return provider === 'google' ? 'google_drive' : 'onedrive'
}

function folderStage(folderId: string, folderName: string, stageByCode: Map<string, ProjectStageRow>, map: StageFolderMap): ProjectStageRow | null {
  const mapped = Object.entries(map).find(([, entry]) => entry.id === folderId)?.[0]
  if (mapped) {
    const stage = [...stageByCode.values()].find((candidate) => candidate.id === mapped)
    if (stage) return stage
  }
  const code = stageCodeFromFolderName(folderName)
  return code ? stageByCode.get(code) ?? null : null
}

async function runSync(input: {
  link: ProjectDriveRow
  admin: boolean
}) {
  const supabase = input.admin ? getDriveAdminClient() : await createClient()
  const link = input.link
  const provider = link.provider as DriveProvider
  const access = { cloudAccountId: link.cloud_account_id, admin: input.admin }
  const now = new Date().toISOString()

  const { data: stages, error: stageError } = await supabase
    .from('project_stages')
    .select('id,code,name,stage_type')
    .eq('project_id', link.project_id)
    .eq('company_id', link.company_id)
    .is('deleted_at', null)
  if (stageError) throw stageError
  if (!stages?.length) throw new Error('El proyecto no tiene etapas disponibles.')

  const stageRows = stages as ProjectStageRow[]
  const stageByCode = new Map(stageRows.map((stage) => [stage.code.toUpperCase(), stage]))
  const defaultStage = stageRows.find((stage) => stage.stage_type === 'management') ?? stageRows[0]
  if (!defaultStage) throw new Error('No se encontró una etapa por defecto.')
  const stageMap = normalizeStageFolderMap(link.stage_folder_map)

  const statusStart = await supabase
    .from('project_cloud_drives')
    .update({ sync_status: 'syncing', sync_error: null, updated_at: now, mutation_id: crypto.randomUUID() })
    .eq('id', link.id)
  if (statusStart.error) throw statusStart.error

  let imported = 0
  let skipped = 0
  let visited = 0
  const seenFileIds = new Set<string>()
  const queue: Array<{ folderId: string; path: string; depth: number; stage: ProjectStageRow | null }> = [
    { folderId: link.root_folder_id, path: '/', depth: 0, stage: null },
  ]

  try {
    while (queue.length) {
      const current = queue.shift()
      if (!current) break
      if (current.depth > MAX_DEPTH) throw new Error(`La estructura supera la profundidad máxima de ${MAX_DEPTH} niveles.`)

      const children = await listDriveItems(provider, current.folderId, access)
      for (const item of children) {
        visited += 1
        if (visited > MAX_ITEMS) throw new Error(`La carpeta supera el límite de ${MAX_ITEMS} elementos por sincronización.`)
        const itemPath = current.path === '/' ? `/${item.name}` : `${current.path}/${item.name}`
        if (item.isFolder) {
          const detectedStage = folderStage(item.id, item.name, stageByCode, stageMap)
          queue.push({ folderId: item.id, path: itemPath, depth: current.depth + 1, stage: detectedStage ?? current.stage })
          continue
        }

        const stage = current.stage ?? defaultStage
        seenFileIds.add(item.id)
        const row: Database['public']['Tables']['documents']['Insert'] = {
          company_id: link.company_id,
          project_id: link.project_id,
          name: item.name,
          provider: documentProvider(provider),
          provider_account_id: link.provider_account_id ?? link.cloud_account_id,
          external_file_id: item.id,
          web_url: item.webUrl,
          mime_type: item.mimeType,
          size_bytes: item.size,
          uploaded_by: link.created_by,
          stage_id: stage.id,
          folder_path: current.path,
          description: '',
          mutation_id: crypto.randomUUID(),
          updated_at: now,
          deleted_at: null,
        }
        const { error } = await supabase
          .from('documents')
          .upsert(row, { onConflict: 'company_id,project_id,provider,provider_account_id,external_file_id' })
        if (error) {
          if (error.code === '23505') { skipped += 1; continue }
          throw error
        }
        imported += 1
      }
    }

    // Reconciliación de eliminados: solo documentos de la cuenta vinculada a este proyecto/proveedor.
    const { data: existing, error: existingError } = await supabase
      .from('documents')
      .select('id,external_file_id,deleted_at')
      .eq('company_id', link.company_id)
      .eq('project_id', link.project_id)
      .eq('provider', documentProvider(provider))
      .eq('provider_account_id', link.provider_account_id ?? link.cloud_account_id)
    if (existingError) throw existingError

    let archived = 0
    for (const row of existing ?? []) {
      if (seenFileIds.has(row.external_file_id) || row.deleted_at) continue
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: now, updated_at: now, mutation_id: crypto.randomUUID() })
        .eq('id', row.id)
      if (error) throw error
      archived += 1
    }

    const { error: finishError } = await supabase
      .from('project_cloud_drives')
      .update({ sync_status: 'synced', sync_error: null, last_sync_at: now, updated_at: now, mutation_id: crypto.randomUUID() })
      .eq('id', link.id)
    if (finishError) throw finishError
    return { imported, skipped, archived, visited }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar la carpeta.'
    await supabase
      .from('project_cloud_drives')
      .update({ sync_status: 'error', sync_error: message.slice(0, 2000), updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() })
      .eq('id', link.id)
    throw error
  }
}

export async function syncProjectDriveLink(linkId: string, options: { admin?: boolean } = {}) {
  const admin = options.admin === true
  const supabase = admin ? getDriveAdminClient() : await createClient()
  const { data: link, error } = await supabase
    .from('project_cloud_drives')
    .select('*')
    .eq('id', linkId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!link) throw new Error('La vinculación de Drive/OneDrive ya no está disponible.')
  return runSync({ link, admin })
}

/** Compatibilidad con Tarea 14 original: importación directa por proveedor/carpeta. */
export async function importDriveStructure(input: { provider: DriveProvider; projectId: string; rootFolderId: string; actorId: string; companyId: string }) {
  const supabase = await createClient()
  const { data: account, error: accountError } = await supabase
    .from('cloud_accounts')
    .select('id,provider_account_id')
    .eq('user_id', input.actorId)
    .eq('company_id', input.companyId)
    .eq('provider', input.provider)
    .is('deleted_at', null)
    .maybeSingle()
  if (accountError) throw accountError
  if (!account) throw new Error('Primero conecta la cuenta de Drive/OneDrive.')

  const { data: linked, error: linkError } = await supabase
    .from('project_cloud_drives')
    .select('id')
    .eq('project_id', input.projectId)
    .eq('company_id', input.companyId)
    .eq('provider', input.provider)
    .is('deleted_at', null)
    .maybeSingle()
  if (linkError) throw linkError
  if (!linked) throw new Error('Primero vincula una carpeta al proyecto desde Integraciones.')
  return syncProjectDriveLink(linked.id)
}
