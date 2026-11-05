import Link from 'next/link'
import { formatMoney } from '@/features/finance/format'
import { DashboardKpis } from './dashboard-kpis'
import { CostDonut, SCurveChart } from './charts'
import type { DashboardData } from './model'
import styles from './dashboard.module.css'

export function ManagementDashboard({ data, currency, portfolio = false }: { data: DashboardData; currency: string; portfolio?: boolean }) {
  return <div className={styles.dashboard}>
    <DashboardKpis data={data} currency={currency} />
    <section aria-label="Gráficos de avance y costos" className={styles.charts}>
      <section className={styles.surface} aria-labelledby="s-curve-heading">
        <div className={styles.chartHeader}><h2 id="s-curve-heading" className={styles.heading}>Curva S</h2><div className={styles.legend}><span><i aria-hidden="true" />Plan</span><span><i aria-hidden="true" />Ejecutado</span></div></div>
        <SCurveChart points={data.curve} />
      </section>
      <section className={styles.surface} aria-labelledby="cost-distribution-heading">
        <div className={styles.chartHeader}><h2 id="cost-distribution-heading" className={styles.heading}>Distribución de Costos</h2></div>
        <CostDonut budget={data.budget} committed={data.committed} executed={data.executed} currency={currency} />
      </section>
    </section>
    <section className={styles.surface} aria-labelledby="critical-items-heading">
      <div className={styles.tableHeader}><h2 id="critical-items-heading" className={styles.heading}>Top 5 Partidas con Mayor Desviación</h2></div>
      <div className={`${styles.tableScroll} overflow-x-auto`} tabIndex={0} role="region" aria-label="Partidas con mayor desviación, tabla desplazable">
        <table className={styles.table}>
          <thead><tr><th scope="col">Partida</th><th scope="col" className={styles.number}>Cotizado</th><th scope="col" className={styles.number}>Ejecutado</th><th scope="col" className={styles.number}>Desviación</th><th scope="col">Estado</th></tr></thead>
          <tbody>{data.criticalItems.map((item) => {
            const critical = item.cost_status === 'critico'
            const warning = item.cost_status === 'alerta_mayor' || item.cost_status === 'alerta_menor'
            const badge = critical ? styles.critical : warning ? styles.warning : styles.normal
            return <tr key={`${item.projectId}-${item.id}`} className="hover:bg-slate-50">
              <td><Link href={`/app/projects/${item.projectId}/partidas`}>{item.code} · {item.description}</Link>{portfolio && <small>{item.projectName}</small>}</td>
              <td className={styles.number}>{formatMoney(item.quoted_total, currency)}</td><td className={styles.number}>{formatMoney(item.actual_total, currency)}</td>
              <td className={`${styles.number} ${styles.negative}`}>+{formatMoney(item.deviation_amount, currency)}{item.deviation_pct != null && <small className="block text-xs text-red-700">+{item.deviation_pct.toFixed(1)}%</small>}</td>
              <td><span className={`${styles.badge} ${badge}`}>{critical ? 'Crítico' : item.cost_status === 'alerta_menor' ? 'Alerta Menor' : warning ? 'Alerta Mayor' : 'Normal'}</span></td>
            </tr>
          })}{data.criticalItems.length === 0 && <tr><td colSpan={5}>Sin partidas con sobrecosto</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </div>
}
