import { redirect } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'
import { normalizeStageFolderMap } from '@/features/drive/drive-utils'
import { isDriveSchemaUnavailable } from '@/features/drive/schema-status'
import { IntegrationsPanel } from '@/features/drive/integrations-panel'
import type { CloudAccountSummary, DriveProvider, ProjectCloudDrive } from '@/features/drive/types'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const ctx = await requireWorkspaceContext()
  if (!['admin', 'pm', 'supervisor'].includes(ctx.profile.role)) redirect('/field/hoy')

  const [{ data: accountRows, error: accountError }, { data: linkRows, error: linkError }] = await Promise.all([
    ctx.supabase
      .from('cloud_accounts')
      .select('id,provider,provider_account_id,account_email,account_name,avatar_url,connected_at')
      .eq('user_id', ctx.userId)
      .eq('company_id', ctx.company.id)
      .is('deleted_at', null),
    ctx.supabase
      .from('project_cloud_drives')
      .select('*')
      .eq('company_id', ctx.company.id)
      .is('deleted_at', null)
      .order('created_at'),
  ])
  const driveSchemaPending = isDriveSchemaUnavailable(accountError) || isDriveSchemaUnavailable(linkError)
  if (accountError && !isDriveSchemaUnavailable(accountError)) throw accountError
  if (linkError && !isDriveSchemaUnavailable(linkError)) throw linkError

  const accounts: Partial<Record<DriveProvider, CloudAccountSummary>> = {}
  for (const row of accountRows ?? []) {
    const provider = row.provider as DriveProvider
    accounts[provider] = {
      id: row.id,
      provider,
      providerAccountId: row.provider_account_id,
      email: row.account_email,
      name: row.account_name,
      avatarUrl: row.avatar_url,
      connectedAt: row.connected_at,
    }
  }

  const projectById = new Map(ctx.projects.map((project) => [project.id, project]))
  const links = (linkRows ?? []).flatMap((row) => {
    const project = projectById.get(row.project_id)
    if (!project) return []
    const link: ProjectCloudDrive & { projectName: string; ownerIsCurrentUser: boolean } = {
      id: row.id,
      projectId: row.project_id,
      provider: row.provider as DriveProvider,
      cloudAccountId: row.cloud_account_id,
      providerAccountId: row.provider_account_id,
      rootFolderId: row.root_folder_id,
      rootFolderName: row.root_folder_name,
      rootFolderUrl: row.root_folder_url,
      stageFolderMap: normalizeStageFolderMap(row.stage_folder_map),
      syncEnabled: row.sync_enabled,
      syncStatus: row.sync_status as ProjectCloudDrive['syncStatus'],
      lastSyncAt: row.last_sync_at,
      syncError: row.sync_error,
      watchExpiresAt: row.watch_expires_at,
      createdBy: row.created_by,
      projectName: project.name,
      ownerIsCurrentUser: row.created_by === ctx.userId,
    }
    return [link]
  })

  return <div className="mx-auto max-w-6xl space-y-8">
    <div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Integraciones</h1></div>
    {driveSchemaPending && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">La base de datos todavía no tiene las tablas de Drive/OneDrive. Aplica <code className="font-mono">20261003143000_task14_drive_onedrive_reinforced.sql</code> en Supabase y recarga esta página.</div>}
    <IntegrationsPanel projects={ctx.projects.map((project) => ({ id: project.id, name: project.name }))} accounts={accounts} links={links} />
  </div>
}
