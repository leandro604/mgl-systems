import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Building2, Flag, CalendarRange } from 'lucide-react'
import { getPlanningOverview } from '@/features/planning/server'
import styles from '@/features/planning/planning-overview.module.css'

export const dynamic = 'force-dynamic'

export default async function PlanningOverviewPage() {
  const data = await getPlanningOverview()
  const summaries = new Map(data.summaries.map((row) => [row.project_id, row]))
  const overdue = data.projects.reduce((sum, project) => sum + Number(summaries.get(project.id)?.overdue_tasks ?? 0), 0)
  const baseline = data.projects.filter((project) => summaries.get(project.id)?.baseline_id).length
  const milestones = data.projects.reduce((sum, project) => sum + Number(summaries.get(project.id)?.milestone_count ?? 0), 0)
  return <div className={styles.page}>
    <div className={styles.header}><div><span className={styles.eyebrow}>MGL · CONTROL DE PLAZOS</span><h1>Planificación y cronograma</h1><p>Una visión clara del avance de cada obra.</p></div><span className={styles.headerBadge}><CalendarRange size={15} />CPM + Curva S</span></div>
    <section className={styles.metrics} aria-label="Resumen de planificación">
      <article className={`${styles.metric} ${styles.featured}`}><div><span>Proyectos con línea base</span><strong>{baseline}<small> / {data.projects.length}</small></strong><p>Cronogramas de referencia</p></div><CalendarRange size={24}/><div className={styles.coverage}><i style={{width:`${data.projects.length ? baseline/data.projects.length*100 : 0}%`}}/></div></article>
      <article className={styles.metric}><div><span>Actividades atrasadas</span><strong className={overdue ? styles.warning : ''}>{overdue}</strong><p>{overdue ? 'Requieren seguimiento' : 'Sin atrasos registrados'}</p></div><span className={styles.amberIcon}><AlertTriangle size={24}/></span></article>
      <article className={styles.metric}><div><span>Hitos registrados</span><strong>{milestones}</strong><p>Puntos clave del cronograma</p></div><span className={styles.greenIcon}><Flag size={24}/></span></article>
    </section>
    <section aria-labelledby="portfolio-title"><div className={styles.sectionTitle}><h2 id="portfolio-title">Portafolio de plazos</h2><span>{data.projects.length} proyectos</span></div>
      <div className={styles.projects}>{data.projects.map((project)=>{
        const summary=summaries.get(project.id)
        const progress=Math.max(0,Math.min(100,Number(summary?.actual_progress_pct??0)))
        const delayed=Number(summary?.overdue_tasks??0)
        return <article key={project.id} className={styles.project}>
          <div className={styles.projectHeader}><span className={styles.building}><Building2 size={20}/></span><span className={styles.code}>{project.code}</span><span className={`${styles.status} ${delayed?styles.statusWarning:summary?.baseline_id?styles.statusReady:styles.statusPending}`}>{delayed?'Requiere atención':summary?.baseline_id?'Con línea base':'Por planificar'}</span></div>
          <h3><Link href={`/app/projects/${project.id}/planning`}>{project.name}</Link></h3>
          <div className={styles.progressLabel}><span>Avance físico</span><strong>{progress.toFixed(1)}<small>%</small></strong></div>
          <div className={styles.progress} role="progressbar" aria-label={`Avance de ${project.name}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress}%`}}/></div>
          <p className={styles.scheduled}>{Number(summary?.scheduled_tasks??0)} de {Number(summary?.active_tasks??0)} tareas programadas</p>
          <dl className={styles.facts}><div><dt>Línea base</dt><dd>{summary?.baseline_version?`Versión ${summary.baseline_version}`:'Pendiente'}</dd></div><div><dt>Atrasadas</dt><dd className={delayed?styles.warning:''}>{delayed}</dd></div><div><dt>Próximo hito</dt><dd>{summary?.next_milestone_on??'Sin fecha'}</dd></div></dl>
          <Link className={styles.open} href={`/app/projects/${project.id}/planning`}>Abrir cronograma<ArrowUpRight size={17}/></Link>
        </article>
      })}</div>
      {!data.projects.length&&<div className={styles.empty}><CalendarRange size={30}/><h3>Aún no hay proyectos</h3><Link href="/app/proyectos">Ir a proyectos <ArrowUpRight size={16}/></Link></div>}
    </section>
  </div>
}
