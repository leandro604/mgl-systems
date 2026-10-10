import { createClient } from '@/lib/supabase/server'
import type { DocumentRow } from '@/types/domain'

export async function getDocumentsForProjects(projectIds: string[]): Promise<DocumentRow[]> {
  if (!projectIds.length) return []
  const supabase = await createClient()
  const documents: DocumentRow[] = []
  // Fetch every page so search never silently excludes references beyond the API row limit.
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('documents').select('*')
      .in('project_id', projectIds).is('deleted_at', null).order('id').range(from, from + 499)
    if (error) throw error
    documents.push(...(data ?? []))
    if ((data?.length ?? 0) < 500) return documents
  }
}
