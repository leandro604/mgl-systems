'use client'

import { AlertTriangle } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { ProgressBar } from '@/components/ui/progress-bar'
import { formatMoney } from '@/features/finance/format'
import type { StageDashboardStage } from './stage-dashboard-model'

const statusLabel = {
  dentro_presupuesto: 'Dentro de presupuesto',
  alerta_menor: 'Alerta menor',
  alerta_mayor: 'Alerta mayor',
  critico: 'Crítico',
} as const

const taskStatus = {
  todo: 'Por hacer',
  in_progress: 'En curso',
  blocked: 'Bloqueada',
  done: 'Terminada',
} as Record<string, string>

function pct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function StageDetailDrawer({
  stage,
  currency,
  onOpenChange,
}: {
  stage: StageDashboardStage | null
  currency: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer open={Boolean(stage)} onOpenChange={onOpenChange} title={stage?.name ?? 'Etapa'}>
      {stage ? (
        <div className="space-y-8">
          <ProgressBar value={stage.progressPct} tone="info" label="Avance" showValue />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-slate-400">Tareas</dt><dd className="mt-1 font-medium tabular-nums text-slate-900">{stage.taskCount}</dd></div>
            <div><dt className="text-xs text-slate-400">Estado costo</dt><dd className="mt-1 font-medium text-slate-900">{stage.hasCostData ? statusLabel[stage.costStatus] : '—'}</dd></div>
            <div><dt className="text-xs text-slate-400">Cotizado</dt><dd className="mt-1 font-medium tabular-nums text-slate-900">{formatMoney(stage.quotedTotal, currency)}</dd></div>
            <div><dt className="text-xs text-slate-400">Real</dt><dd className="mt-1 font-medium tabular-nums text-slate-900">{formatMoney(stage.actualTotal, currency)}</dd></div>
            <div><dt className="text-xs text-slate-400">Desviación</dt><dd className="mt-1 font-medium tabular-nums text-slate-900">{formatMoney(stage.deviationAmount, currency)}</dd></div>
            <div><dt className="text-xs text-slate-400">Desviación %</dt><dd className="mt-1 font-medium tabular-nums text-slate-900">{pct(stage.deviationPct)}</dd></div>
          </dl>
          {stage.criticalItems ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="size-4" />
              {stage.criticalItems} partida(s) crítica(s)
            </div>
          ) : null}
          <div>
            <h3 className="mb-4 text-sm font-medium text-slate-700">Tareas</h3>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {stage.tasks.length ? stage.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{task.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{taskStatus[task.status] ?? task.status}</p>
                  </div>
                  <span className="text-xs tabular-nums text-slate-500">{task.progress}%</span>
                </div>
              )) : <p className="py-5 text-sm text-slate-400">Sin tareas.</p>}
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}
