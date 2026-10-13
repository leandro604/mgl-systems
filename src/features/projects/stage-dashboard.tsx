import Link from 'next/link'
import { Activity, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMoney } from '@/features/finance/format'
import type { CostStatus } from '@/lib/db/schema'
import type { StageDashboardData } from './stage-dashboard-model'
import { StageDashboardStages } from './stage-dashboard-stages'

const statusLabel: Record<CostStatus, string> = {
  dentro_presupuesto: 'Dentro de presupuesto',
  alerta_menor: 'Alerta menor',
  alerta_mayor: 'Alerta mayor',
  critico: 'Crítico',
}

const statusVariant: Record<CostStatus, NonNullable<BadgeProps['variant']>> = {
  dentro_presupuesto: 'success',
  alerta_menor: 'warning',
  alerta_mayor: 'warning',
  critico: 'danger',
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function activityTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function activityGroup(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const day = 86400000
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diff = Math.round((start - target) / day)
  if (diff <= 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return 'Esta semana'
}

export function StageDashboard({ data, currency = 'PEN' }: { data: StageDashboardData; currency?: string }) {
  const deviationPositive = data.deviationAmount > 0
  const groupedActivity = data.recentActivity.reduce<Record<string, typeof data.recentActivity>>((acc, item) => {
    const key = activityGroup(item.createdAt)
    ;(acc[key] ??= []).push(item)
    return acc
  }, {})

  return (
    <section className="space-y-8" aria-labelledby="stage-dashboard-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Control gerencial</p>
          <h2 id="stage-dashboard-title" className="mt-2 text-lg font-medium tracking-tight text-slate-950">Dashboard por etapas</h2>
        </div>
        {data.hasCostData && data.costStatus !== 'dentro_presupuesto' ? <Badge variant={statusVariant[data.costStatus]}>{statusLabel[data.costStatus]}</Badge> : null}
      </div>

      <Card>
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Desviación global</CardTitle>
            <div className="flex items-center gap-2">
              {deviationPositive ? <TrendingUp className="size-4 text-red-600" /> : <TrendingDown className="size-4 text-green-600" />}
              <span className={deviationPositive ? 'text-sm font-medium tabular-nums text-red-700' : 'text-sm font-medium tabular-nums text-green-700'}>{formatPct(data.deviationPct)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 sm:grid-cols-3">
          <div><p className="text-xs text-slate-400">Cotizado</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(data.quotedTotal,currency)}</p></div>
          <div><p className="text-xs text-slate-400">Real</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(data.actualTotal,currency)}</p></div>
          <div><p className="text-xs text-slate-400">Desviación</p><p className={deviationPositive ? 'mt-2 text-3xl font-semibold tabular-nums text-red-700' : 'mt-2 text-3xl font-semibold tabular-nums text-green-700'}>{formatMoney(data.deviationAmount,currency)}</p></div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4"><h3 className="text-sm font-medium text-slate-700">Etapas del proyecto</h3><span className="text-xs text-slate-400">{data.stages.length} etapas</span></div>
        <StageDashboardStages stages={data.stages} currency={currency} />
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader><CardTitle>Top 5 partidas con mayor desviación</CardTitle></CardHeader>
          <CardContent>
            {data.topDeviations.length === 0 ? <EmptyState title="Sin desviaciones" /> : <div className="divide-y divide-slate-100">
              {data.topDeviations.map((item) => <div key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{item.code} · {item.description}</p><p className="mt-1 text-xs tabular-nums text-slate-400">{formatMoney(item.quoted_total,currency)} → {formatMoney(item.actual_total,currency)}</p></div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-red-700">{formatPct(item.deviation_pct)}</span>
                <Badge variant={statusVariant[item.cost_status]} className="hidden shrink-0 sm:inline-flex">{statusLabel[item.cost_status]}</Badge>
              </div>)}
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center gap-2"><Activity className="size-4 text-blue-600" /><CardTitle>Actividad reciente</CardTitle></div></CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? <EmptyState title="Sin actividad" /> : <div className="space-y-5">
              {['Hoy','Ayer','Esta semana'].map((group) => groupedActivity[group]?.length ? <div key={group}><p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">{group}</p><div className="divide-y divide-slate-100">{groupedActivity[group].map((item) => {
                const content = <div className="flex items-center gap-3 py-3"><span className={item.readAt ? 'size-2 shrink-0 rounded-full bg-slate-300' : 'size-2 shrink-0 rounded-full bg-blue-600'} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-400">{activityTime(item.createdAt)}</p></div>{item.actionUrl ? <ArrowUpRight className="size-4 shrink-0 text-slate-400" /> : null}</div>
                return item.actionUrl ? <Link key={item.id} href={item.actionUrl} className="block hover:bg-slate-50">{content}</Link> : <div key={item.id}>{content}</div>
              })}</div></div> : null)}
            </div>}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
