import { ProjectDocumentsPanel } from '@/features/documents/project-documents-panel'
import { requireWorkspaceContext } from '@/features/auth/server'
import { getDocumentsForProjects } from '@/features/documents/server'

export default async function DocumentsPage() {
  const { supabase, projects, company } = await requireWorkspaceContext()
  const [stages, profiles, documents] = await Promise.all([
    supabase.from('project_stages').select('id,project_id,code,name,sort_order,is_locked').is('deleted_at', null).order('sort_order'),
    supabase.from('profiles').select('user_id,full_name').eq('company_id', company.id).is('deleted_at', null),
    getDocumentsForProjects(projects.map((project) => project.id)),
  ])
  if (stages.error) throw stages.error
  if (profiles.error) throw profiles.error
  return <ProjectDocumentsPanel projectId="" projectName="todos tus proyectos" projects={projects} initialDocuments={documents} stages={stages.data ?? []} members={profiles.data ?? []} />
}
