'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CheckCircle, TrendingUp, Wallet } from 'lucide-react'
import { formatMoney } from '@/features/finance/format'
import type { DashboardData } from './model'
import styles from './dashboard.module.css'

export function DashboardKpis({ data, currency }: { data: DashboardData; currency: string }) {
  const reducedMotion = useReducedMotion()
  const metrics = [
    { label: 'Presupuesto Global', value: formatMoney(data.budget, currency), icon: Wallet },
    { label: 'Costo Ejecutado', value: formatMoney(data.executed, currency), icon: TrendingUp },
    { label: 'Avance Físico', value: `${data.progress.toFixed(1)}%`, icon: CheckCircle, progress: true },
    { label: 'Desviación de Costos', value: formatMoney(data.variance, currency), icon: AlertTriangle, negative: data.variance < 0 },
  ]
  return <section aria-label="Indicadores principales" className={styles.kpis}>
    {metrics.map(({ label, value, icon: Icon, progress, negative }) => <motion.article key={label}
      whileHover={reducedMotion ? {} : { y: -4 }} transition={{ duration: 0.18 }}
      className={`${styles.kpi} bg-white border border-slate-200 rounded-xl shadow-sm p-6`}>
      <h2 className={`${styles.kpiTitle} text-sm font-medium text-slate-500`} title={label === 'Desviación de Costos' ? 'Presupuesto menos costo ejecutado; negativo indica sobrecosto.' : undefined}>{label}</h2>
      <span className={styles.icon}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
      <p className={`${styles.kpiValue} text-3xl font-bold ${negative ? `${styles.negative} text-red-600` : 'text-slate-900'}`}>{value}</p>
      {progress && <div className={styles.progress} role="progressbar" aria-label="Avance físico" aria-valuenow={data.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${data.progress}%` }} /></div>}
    </motion.article>)}
  </section>
}
