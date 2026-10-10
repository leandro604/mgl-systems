import type { BrowserSupabaseClient } from '@/lib/supabase/client'
import type { MglLocalDb } from '@/lib/db/dexie'
import type { LocalProject } from '@/lib/db/schema'
import type { VerifiedIdentity } from '@/types/domain'

export async function createProjectOnline(
  client: BrowserSupabaseClient,
  db: MglLocalDb,
  identity: VerifiedIdentity,
  input: { code: string; name: string },
): Promise<LocalProject> {
  if (identity.role !== 'admin' && identity.role !== 'pm') {
    throw new Error('Only admin or PM can create projects')
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Project creation requires connectivity in Fase 2')
  }

  const id = crypto.randomUUID()
  const { data, error } = await client.rpc('create_project', {
    p_id: id,
    p_company_id: identity.companyId,
    p_code: input.code.trim(),
    p_name: input.name.trim(),
  })
  if (error) throw error

  const local: LocalProject = {
    ...data,
    pending_sync: false,
    sync_error: null,
    local_updated_at: data.updated_at,
  }
  await db.projects.put(local)
  return local
}

export async function listActiveProjectsLocal(db: MglLocalDb): Promise<LocalProject[]> {
  return db.projects.filter((project) => project.deleted_at === null).sortBy('name')
}
