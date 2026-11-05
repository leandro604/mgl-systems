'use client'

import { useId } from 'react'
import { Area, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CurvePoint } from '@/features/planning/curve'
import { formatMoney } from '@/features/finance/format'
import styles from './dashboard.module.css'

const tooltipStyle = { border: '1px solid #e2e8f0', borderRadius: 10, backgroundColor: '#fff', color: '#0f172a', boxShadow: '0 6px 20px #0f172a12', fontSize: 12 }
function shortDate(date: string) {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function SCurveChart({ points }: { points: CurvePoint[] }) {
  const gradient = useId().replaceAll(':', '')
  if (points.length < 2) return <div className={styles.chartEmpty}>Línea base no disponible</div>
  return <div className={styles.curve} role="img" aria-label="Curva S: avance planificado en azul y ejecutado en verde, expresado en porcentaje">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={points} margin={{ top: 12, right: 16, bottom: 4, left: 0 }} accessibilityLayer>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.12} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} minTickGap={40} tickMargin={12} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value: number) => `${value}%`} tick={{ fill: '#475569', fontSize: 11 }} width={43} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#1e293b' }} labelStyle={{ color: '#0f172a', fontWeight: 600 }} labelFormatter={(label) => shortDate(String(label))} formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]} />
        <Area type="linear" dataKey="planned" name="Plan" stroke="#2563eb" strokeWidth={2.5} fill={`url(#${gradient})`} isAnimationActive={false} />
        <Line type="linear" dataKey="actual" name="Ejecutado" stroke="#059669" strokeWidth={2.5} strokeDasharray="5 5" dot={false} connectNulls={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
}

export function CostDonut({ budget, committed, executed, currency }: { budget: number; committed: number; executed: number; currency: string }) {
  // These are three independently labelled metrics, not additive budget shares.
  // Keep the legend in currency; do not show a misleading summed total or %.
  const values = [
    { name: 'Cotizado', value: Math.max(0, budget), fill: '#2563eb' },
    { name: 'Comprometido', value: Math.max(0, committed), fill: '#8b5cf6' },
    { name: 'Ejecutado', value: Math.max(0, executed), fill: '#059669' },
  ]
  const hasData = values.some((item) => item.value > 0)
  return <>
    <div className={styles.donut} role="img" aria-label={`Distribución de costos. ${values.map((item) => `${item.name}: ${formatMoney(item.value, currency)}`).join('. ')}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart accessibilityLayer>
          <Pie data={hasData ? values : [{ name: 'Sin costos registrados', value: 1, fill: '#e2e8f0' }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={80} paddingAngle={hasData ? 3 : 0} stroke="none" isAnimationActive={false} />
          {hasData && <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#1e293b' }} formatter={(value) => formatMoney(Number(value), currency)} />}
        </PieChart>
      </ResponsiveContainer>
    </div>
    <dl className={styles.costLegend}>{values.map((item) => <div key={item.name}><dt><i style={{ background: item.fill }} aria-hidden="true" />{item.name}</dt><dd>{formatMoney(item.value, currency)}</dd></div>)}</dl>
  </>
}
