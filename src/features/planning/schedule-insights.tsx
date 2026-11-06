'use client'

import type { ReactNode } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { LocalTask } from '@/lib/db/schema'
import type { CpmResult } from './cpm'
import styles from './schedule.module.css'

type Props = { tasks: LocalTask[]; today: string; cpm: CpmResult; planned: number | null; actual: number; children: ReactNode; onInspect: (filter: string) => void }
export function ScheduleInsights({ tasks, today, cpm, planned, actual, children, onInspect }: Props) {
  const active = tasks.filter(t => t.task_type !== 'summary')
  const complete = active.filter(t => t.progress >= 100)
  const late = active.filter(t => t.progress < 100 && t.due_on && t.due_on < today)
  const unscheduled = active.filter(t => t.progress < 100 && (!t.starts_on || !t.due_on) && !late.includes(t))
  const scheduled = active.length - complete.length - late.length - unscheduled.length
  const data = [
    { name: 'Completadas', value: complete.length, color: '#059669' },
    { name: 'Atrasadas', value: late.length, color: '#dc2626' },
    { name: 'Programadas pendientes', value: scheduled, color: '#2563eb' },
    { name: 'Sin programar', value: unscheduled.length, color: '#64748b' },
  ]
  const gap = planned === null ? null : actual - planned
  const priority = [...late].sort((a,b) => Number(Boolean(cpm.metrics.get(b.id)?.critical)) - Number(Boolean(cpm.metrics.get(a.id)?.critical)) || a.due_on!.localeCompare(b.due_on!)).slice(0,3)
  return <>
    <section className={styles.insights}>
      <article className={styles.panel}><div className={styles.heading}><div><p className={styles.eyebrow}>AVANCE DEL PROYECTO</p><h3>Plan frente a ejecución</h3></div><span className={gap !== null && gap < -2 ? styles.danger : styles.neutral}>{gap === null ? 'Sin línea base' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp`}</span></div>
        <div className={styles.legend}><span><i style={{background:'#2563eb'}} />Plan {planned === null ? '—' : `${planned.toFixed(1)}%`}</span><span><i style={{background:'#059669'}} />Ejecutado {actual.toFixed(1)}%</span></div>
        {children}<p className={styles.muted}>{gap === null ? 'Crea una línea base para comparar el avance.' : gap < 0 ? `El avance real está ${Math.abs(gap).toFixed(1)} puntos porcentuales por debajo del plan.` : `El avance real está ${gap.toFixed(1)} puntos porcentuales por encima del plan.`}</p>
      </article>
      <article className={styles.panel}><p className={styles.eyebrow}>ESTADO DEL TRABAJO</p><h3>Actividades en perspectiva</h3><div className={styles.donut}>
        {active.length ? <ResponsiveContainer width="100%" height={190}><PieChart><Pie data={data.filter(d => d.value > 0)} dataKey="value" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={3} isAnimationActive={false}>{data.filter(d=>d.value>0).map(d=><Cell key={d.name} fill={d.color}/>)}</Pie><Tooltip contentStyle={{background:'#fff',border:'1px solid #cbd5e1',borderRadius:12,color:'#0f172a'}} /></PieChart></ResponsiveContainer> : <p className={styles.empty}>Todavía no hay actividades.</p>}
      </div><ul className={styles.statusList}>{data.map(d=><li key={d.name}><span><i style={{background:d.color}}/>{d.name}</span><strong>{d.value}</strong></li>)}</ul></article>
    </section>
    <section className={styles.attention}><div><p className={styles.eyebrow}>FOCO DE ATENCIÓN</p><h3>{late.length ? `${late.length} actividades requieren seguimiento` : 'Sin actividades vencidas pendientes'}</h3><p className={styles.muted}>La ruta crítica indica actividades sin holgura; no significa que estén atrasadas.</p></div><button type="button" onClick={()=>onInspect('overdue')}>Revisar atrasadas →</button>
      {priority.length ? <div className={styles.priorityList}>{priority.map(t=><div key={t.id}><strong>{t.wbs_code ? `${t.wbs_code} · ` : ''}{t.title}</strong><span>Venció {t.due_on} · {t.progress}% de avance</span>{cpm.metrics.get(t.id)?.critical ? <span className={styles.critical}>Ruta crítica</span> : null}</div>)}</div> : null}
    </section>
  </>
}
