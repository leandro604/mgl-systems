import { ProjectDocumentsPanel } from '@/features/documents/project-documents-panel'
import { CloudUploadPanel } from '@/features/drive/cloud-upload-panel'
import { normalizeStageFolderMap } from '@/features/drive/drive-utils'
import { isDriveSchemaUnavailable } from '@/features/drive/schema-status'
import type { DriveProvider } from '@/features/drive/types'
import { getProjectPeople, requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'
import { getDocumentsForProjects } from '@/features/documents/server'

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ focus?: string | string[] | undefined }>
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams])
  const initialSelectedId = typeof query.focus === 'string' ? query.focus : undefined
  const supabase = await createClient()
  const [context, result, stages, people, driveLinks] = await Promise.all([
    requireProjectContext(projectId),
    getDocumentsForProjects([projectId]),
    supabase.from('project_stages').select('id,code,name,sort_order,is_locked').eq('project_id', projectId).is('deleted_at', null).order('sort_order'),
    getProjectPeople(projectId),
    supabase.from('project_cloud_drives').select('id,provider,root_folder_id,root_folder_name,stage_folder_map,created_by').eq('project_id', projectId).is('deleted_at', null),
  ])
  if (stages.error) throw stages.error
  const driveSchemaPending = isDriveSchemaUnavailable(driveLinks.error)
  if (driveLinks.error && !driveSchemaPending) throw driveLinks.error
  const stageRows = stages.data ?? []
  const connections = (driveLinks.data ?? []).filter((link) => link.created_by === context.userId).map((link) => ({
    id: link.id,
    provider: link.provider as DriveProvider,
    rootFolderId: link.root_folder_id,
    rootFolderName: link.root_folder_name,
    stageFolderMap: normalizeStageFolderMap(link.stage_folder_map),
  }))

  return <div className="space-y-6">
    {driveSchemaPending && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">La integración Drive/OneDrive está pendiente de activar en Supabase. Aplica la migración de la Tarea 14 para habilitar vinculación, sincronización y subida cloud.</div>}
    <CloudUploadPanel projectId={projectId} stages={stageRows} connections={connections} />
    <ProjectDocumentsPanel
      projectId={projectId}
      projectName={context.project.name}
      initialDocuments={result}
      stages={stageRows}
      members={people.allProfiles}
      {...(initialSelectedId ? { initialSelectedId } : {})}
    />
  </div>
}
