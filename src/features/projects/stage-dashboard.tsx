import Link from 'next/link'
import { Activity, AlertTriangle, ArrowUpRight, LockKeyhole, TrendingDown, TrendingUp } from 'lucide-react'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressBar } from '@/components/ui/progress-bar'
import { formatMoney } from '@/features/finance/format'
import type { CostStatus } from '@/lib/db/schema'
import type { StageDashboardData } from './stage-dashboard-model'

const statusLabel: Record<CostStatus, string> = {
  dentro_presupuesto: 'Dentro de presupuesto',
  alerta_menor: 'Alerta menor',
  alerta_mayor: 'Alerta mayor',
  critico: 'Crítico',
}

const statusVariant: Record<CostStatus, NonNullable<BadgeProps['variant']>> = {
  dentro_presupuesto: 'success',
  alerta_menor: 'warning',
  alerta_mayor: 'danger',
  critico: 'critical',
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)} %`
}

function activityTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function StageDashboard({
  data,
  currency = 'PEN',
}: {
  data: StageDashboardData
  currency?: string
}) {
  const deviationPositive = data.deviationAmount > 0
  const status = data.costStatus

  return (
    <section className="space-y-6" aria-labelledby="stage-dashboard-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Control gerencial</p>
          <h2 id="stage-dashboard-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            Dashboard por etapas
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Avance operativo y desviación cotizado vs. real en una sola vista.
          </p>
        </div>
        {data.hasCostData ? (
          <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
        ) : (
          <Badge variant="neutral">Sin datos de costo</Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200 bg-slate-50/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Desviación global</CardTitle>
              
            </div>
            <div className="flex items-center gap-2">
              {deviationPositive ? (
                <TrendingUp className="size-5 text-red-600" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-5 text-green-600" aria-hidden="true" />
              )}
              <span className={deviationPositive ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold text-green-700'}>
                {formatPct(data.deviationPct)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cotizado</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{formatMoney(data.quotedTotal, currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Real</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{formatMoney(data.actualTotal, currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Desviación</p>
            <p className={deviationPositive ? 'mt-2 text-2xl font-semibold tabular-nums text-red-700' : 'mt-2 text-2xl font-semibold tabular-nums text-green-700'}>
              {formatMoney(data.deviationAmount, currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-950">Etapas del proyecto</h3>
          <span className="text-xs text-slate-500">{data.stages.length} etapas operativas</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data.stages.map((stage) => (
            <Card key={stage.id} className="min-h-[220px]">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-700">{stage.code}</p>
                    <CardTitle className="mt-1 truncate text-base">{stage.name}</CardTitle>
                  </div>
                  {stage.isLocked ? (
                    <Badge variant="neutral" className="shrink-0 gap-1">
                      <LockKeyhole className="size-3" aria-hidden="true" />
                      Cerrada
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressBar
                  value={stage.progressPct}
                  tone="info"
                  label="Avance"
                  showValue
                />

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Tareas</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{stage.taskCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Estado costo</dt>
                    <dd className="mt-1">
                      {stage.hasCostData ? (
                        <Badge variant={statusVariant[stage.costStatus]}>{statusLabel[stage.costStatus]}</Badge>
                      ) : (
                        <Badge variant="neutral">Sin costo</Badge>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Cotizado</dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">{formatMoney(stage.quotedTotal, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Real</dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">{formatMoney(stage.actualTotal, currency)}</dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">Δ {formatPct(stage.deviationPct)}</span>
                  {stage.criticalItems > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-red-700">
                      <AlertTriangle className="size-3.5" />
                      {stage.criticalItems} crítica(s)
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 partidas con mayor desviación</CardTitle>
            
          </CardHeader>
          <CardContent>
            {data.topDeviations.length === 0 ? (
              <EmptyState
                title="Sin desviaciones"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="py-3 pr-4">Partida</th>
                      <th className="px-4 py-3 text-right">Cotizado</th>
                      <th className="px-4 py-3 text-right">Real</th>
                      <th className="px-4 py-3 text-right">Δ</th>
                      <th className="py-3 pl-4 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topDeviations.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-900">{item.code}</p>
                          <p className="mt-0.5 max-w-[340px] truncate text-xs text-slate-500">{item.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(item.quoted_total, currency)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(item.actual_total, currency)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-red-700">{formatPct(item.deviation_pct)}</td>
                        <td className="py-3 pl-4 text-right"><Badge variant={statusVariant[item.cost_status]}>{statusLabel[item.cost_status]}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-blue-600" aria-hidden="true" />
              <CardTitle>Actividad reciente</CardTitle>
            </div>
            
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState
                title="Sin actividad"
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentActivity.map((item) => {
                  const content = (
                    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <span className={item.readAt ? 'mt-1.5 size-2 shrink-0 rounded-full bg-slate-300' : 'mt-1.5 size-2 shrink-0 rounded-full bg-blue-600'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        {item.body ? <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p> : null}
                        <p className="mt-1 text-[11px] text-slate-400">{activityTime(item.createdAt)}</p>
                      </div>
                      {item.actionUrl ? <ArrowUpRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" /> : null}
                    </div>
                  )

                  return item.actionUrl ? (
                    <Link key={item.id} href={item.actionUrl} className="block rounded-md hover:bg-slate-50">
                      {content}
                    </Link>
                  ) : (
                    <div key={item.id}>{content}</div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
