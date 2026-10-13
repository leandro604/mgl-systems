'use client'

import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import type { StageDashboardStage } from './stage-dashboard-model'
import { StageDetailDrawer } from './stage-detail-drawer'

const statusLabel = {
  dentro_presupuesto: 'Dentro de presupuesto',
  alerta_menor: 'Alerta menor',
  alerta_mayor: 'Alerta mayor',
  critico: 'Crítico',
} as const

const dotClass = {
  dentro_presupuesto: 'bg-green-500',
  alerta_menor: 'bg-amber-400',
  alerta_mayor: 'bg-amber-600',
  critico: 'bg-red-600',
} as const

export function StageDashboardStages({ stages, currency }: { stages: StageDashboardStage[]; currency: string }) {
  const [selected, setSelected] = useState<StageDashboardStage | null>(null)

  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stages.map((stage) => (
        <button
          key={stage.id}
          type="button"
          onClick={() => setSelected(stage)}
          className="min-h-[72px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
        >
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{stage.name}</span>
            {stage.isLocked ? <LockKeyhole className="size-3.5 shrink-0 text-slate-400" aria-label="Cerrada" /> : null}
            {stage.hasCostData && stage.costStatus !== 'dentro_presupuesto' ? <span className={`size-2.5 shrink-0 rounded-full ${dotClass[stage.costStatus]}`} aria-label={statusLabel[stage.costStatus]} /> : null}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${Math.max(0,Math.min(100,stage.progressPct))}%`}} /></div>
            <span className="w-10 text-right text-xs font-medium tabular-nums text-slate-500">{Math.round(stage.progressPct)}%</span>
          </div>
        </button>
      ))}
    </div>

    <StageDetailDrawer stage={selected} currency={currency} onOpenChange={(open) => { if (!open) setSelected(null) }} />
  </>
}
