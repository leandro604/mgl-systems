import { ProjectSstPanel } from '@/features/sst/project-sst-panel'
import { requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectSstPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const supabase = await createClient()
  const [, data] = await Promise.all([
    requireProjectContext(projectId),
    Promise.all([
      supabase.from('sst_records').select('*').eq('project_id', projectId).is('deleted_at', null).order('occurred_at', { ascending: false }),
      supabase.from('documents').select('id,name').eq('project_id', projectId).is('deleted_at', null).order('name'),
    ]),
  ])
  const [{ data: records, error: recordError }, { data: documents, error: documentError }] = data
  if (recordError) throw recordError
  if (documentError) throw documentError
  return <ProjectSstPanel projectId={projectId} initialRecords={records ?? []} documents={documents ?? []} />
}
