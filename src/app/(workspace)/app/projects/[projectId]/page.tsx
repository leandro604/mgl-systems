import Link from 'next/link'
import { ClipboardCheck, FileText, ShieldCheck, Users } from 'lucide-react'
import { canAccessFinancialModules } from '@/features/auth/roles'
import { ManagementDashboard } from '@/features/dashboard/management-dashboard'
import { buildDashboardData } from '@/features/dashboard/model'
import { getDashboardProject } from '@/features/dashboard/server'
import styles from '@/features/dashboard/dashboard.module.css'
import { ProjectSettingsForm } from '@/features/projects/project-settings-form'
import { StageDashboardStages } from '@/features/projects/stage-dashboard-stages'
import { requireProjectContext } from '@/features/projects/server'

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { project, profile, company, supabase } = await requireProjectContext(projectId)
  const financial = canAccessFinancialModules(profile.role)
  const [dashboard, tasks, docs, sst, members] = await Promise.all([
    financial ? getDashboardProject(project) : Promise.resolve(null),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
    supabase.from('sst_records').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
    supabase.from('project_members').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
  ])
  for (const result of [tasks, docs, sst, members]) if (result.error) throw result.error
  const links = [
    { name: 'Tareas', count: tasks.count, path: 'tasks', icon: ClipboardCheck },
    { name: 'Documentos', count: docs.count, path: 'documents', icon: FileText },
    { name: 'SST', count: sst.count, path: 'sst', icon: ShieldCheck },
    { name: 'Equipo', count: members.count, path: 'team', icon: Users },
  ]
  return <div className={`${styles.dashboard} mx-auto max-w-7xl`}>
    {dashboard && <ManagementDashboard data={buildDashboardData([dashboard.data])} currency={company.currency} />}
    {dashboard && <details className={`${styles.surface} ${styles.details}`}><summary>Etapas del proyecto</summary><StageDashboardStages stages={dashboard.stages} currency={company.currency} /></details>}
    <details className={`${styles.surface} ${styles.details}`} open={!financial}>
      <summary>Operación del proyecto</summary>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">{links.map(({ name, count, path, icon: Icon }) => <Link key={path} href={`/app/projects/${projectId}/${path}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-900 hover:bg-slate-50"><Icon size={18} className="shrink-0 text-blue-600" /><span>{name}</span><span className="ml-auto tabular-nums">{count ?? 0}</span></Link>)}</div>
      {financial && <div className="mt-4 flex flex-wrap gap-3">{[['partidas', 'Partidas'], ['control', 'Control'], ['purchases', 'Compras'], ['invoices', 'Facturación']].map(([path, label]) => <Link key={path} href={`/app/projects/${projectId}/${path}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">{label}</Link>)}</div>}
    </details>
    <details className={`${styles.surface} ${styles.details}`}>
      <summary>Datos del proyecto</summary>
      {financial ? <ProjectSettingsForm project={project} /> : <dl className="grid gap-4 text-sm text-slate-900 sm:grid-cols-2">{[['Código', project.code], ['Estado', project.status], ['Inicio', project.starts_on ?? 'Sin fecha'], ['Fin', project.ends_on ?? 'Sin fecha']].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>}
    </details>
  </div>
}
