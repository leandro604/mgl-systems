import Link from 'next/link'
import { ArrowUpRight, ClipboardCheck, FileText, FolderKanban, ShieldCheck } from 'lucide-react'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canAccessFinancialModules } from '@/features/auth/roles'
import { ManagementDashboard } from '@/features/dashboard/management-dashboard'
import { getPortfolioDashboard } from '@/features/dashboard/server'
import styles from '@/features/dashboard/dashboard.module.css'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const context = await requireWorkspaceContext()
  const { supabase, projects, profile, company } = context
  const financial = canAccessFinancialModules(profile.role)
  const ids = projects.map((project) => project.id)
  const data = financial ? await getPortfolioDashboard(projects) : null
  const counts = !financial && ids.length ? await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('project_id', ids).is('deleted_at', null).neq('status', 'done'),
    supabase.from('documents').select('id', { count: 'exact', head: true }).in('project_id', ids).is('deleted_at', null),
    supabase.from('sst_records').select('id', { count: 'exact', head: true }).in('project_id', ids).is('deleted_at', null),
  ]) : []
  for (const result of counts) if (result.error) throw result.error
  const operational = [
    ['Proyectos', projects.length, FolderKanban], ['Tareas abiertas', counts[0]?.count ?? 0, ClipboardCheck],
    ['Documentos', counts[1]?.count ?? 0, FileText], ['SST', counts[2]?.count ?? 0, ShieldCheck],
  ] as const
  return <div className={`${styles.dashboard} mx-auto max-w-7xl`}>
    <div className={styles.welcome}>
      <div><span className={styles.eyebrow}>VISTA GENERAL · MGL SYSTEMS</span><h1>Hola, {profile.full_name?.trim().split(/\s+/)[0] || 'bienvenido'}<span className={styles.greetingDot}>.</span></h1><p>Así avanzan tus obras.</p></div>
      <div className={styles.quickActions}><Link href="/app/tasks">Mis tareas <ClipboardCheck size={16} /></Link><Link href="/app/proyectos" className={styles.primaryAction}>Ver proyectos <ArrowUpRight size={17} /></Link></div>
    </div>
    {data ? <ManagementDashboard data={data} currency={company.currency} portfolio /> : <section className={styles.kpis} aria-label="Resumen operativo">
      {operational.map(([label, value, Icon]) => <article key={label} className={`${styles.kpi} ${styles.surface} p-6`}><h2 className={styles.kpiTitle}>{label}</h2><span className={styles.icon}><Icon size={20} aria-hidden="true" /></span><p className={styles.kpiValue}>{value}</p></article>)}
    </section>}
    <details className={`${styles.surface} ${styles.details}`} open={!financial}>
      <summary>Proyectos · {projects.length}</summary>
      <div className="divide-y divide-slate-100">{projects.map((project) => <Link key={project.id} href={`/app/proyectos/${project.id}/dashboard`} className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm text-slate-900 hover:bg-slate-50"><span className="min-w-0 font-medium [overflow-wrap:anywhere]">{project.name}</span><span className="text-slate-800">{project.code}</span></Link>)}</div>
      {!projects.length && <p className="py-4 text-sm text-slate-800">Sin proyectos</p>}
    </details>
  </div>
}
