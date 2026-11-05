import Link from 'next/link'
import { ArrowUpRight, Building2, Layers3, MoveUpRight } from 'lucide-react'
import type { DashboardData } from './model'
import styles from './dashboard.module.css'

export function DashboardOverview({ data, portfolio }: { data: DashboardData; portfolio: boolean }) {
  const planning = !portfolio && data.projects[0] ? `/app/projects/${data.projects[0].id}/planning` : '/app/planning'
  return <section className={styles.overview} aria-label="Tu espacio de gestión">
    <div className={styles.spotlight}>
      <Layers3 className={styles.spotlightArt} aria-hidden="true" />
      <span className={styles.spotlightLabel}><span />MGL · CONTROL DE OBRA</span>
      <h2>Del plan<br />a la ejecución.</h2>
      <p>Todo tu equipo. Una misma dirección.</p>
      <Link href={planning}>Abrir planificación <ArrowUpRight size={17} /></Link>
    </div>
    <section className={`${styles.surface} ${styles.projectPulse}`} aria-labelledby="project-pulse-title">
      <div className={styles.pulseHeader}><div><span className={styles.eyebrow}>EN SEGUIMIENTO</span><h2 id="project-pulse-title" className={styles.heading}>{portfolio ? 'El pulso de tus proyectos' : 'Tu proyecto en marcha'}</h2></div><Link href="/app/proyectos" aria-label="Ver todos los proyectos"><ArrowUpRight size={20} /></Link></div>
      <div className={styles.projectRows}>
        {data.projects.slice(0, 3).map((project) => <Link key={project.id} href={`/app/proyectos/${project.id}/dashboard`} className={styles.projectRow}>
          <span className={styles.projectIcon}><Building2 size={19} strokeWidth={1.6} /></span>
          <span className={styles.projectName}><small>{project.code}</small><strong>{project.name}</strong></span>
          <span className={styles.projectProgress}><strong>{project.progress.toFixed(1)}%</strong><span><i style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} /></span></span>
          <MoveUpRight size={15} aria-hidden="true" />
        </Link>)}
        {!data.projects.length && <p className="py-6 text-sm text-slate-800">Tus proyectos aparecerán aquí.</p>}
      </div>
    </section>
  </section>
}
