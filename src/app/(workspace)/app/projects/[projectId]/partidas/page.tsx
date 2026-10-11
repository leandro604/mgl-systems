import Link from 'next/link'
import { ArrowRight, Table2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BudgetImportPanel } from '@/features/budget/budget-import-panel'
import { BudgetItemsTable } from '@/features/budget/budget-items-table'
import { getBudgetItemsModule } from '@/features/budget/server'
import type { AppRole } from '@/types/domain'

export default async function BudgetItemsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const data = await getBudgetItemsModule(projectId)

  if (!data.allowed) {
    return (
      <Card>
        <CardHeader><CardTitle>Partidas</CardTitle><CardDescription>Tu rol no tiene acceso al control gerencial de partidas.</CardDescription></CardHeader>
      </Card>
    )
  }

  const currency = data.baseline?.currency ?? data.company.currency

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Table2 className="size-5 text-blue-600" /><h2 className="text-xl font-semibold text-slate-950">Módulo de partidas</h2></div>
                  </div>
        <Button asChild variant="secondary" size="sm"><Link href={`/app/projects/${projectId}/control`}>Presupuestos y valorizaciones <ArrowRight /></Link></Button>
      </div>

      <BudgetItemsTable
        projectId={projectId}
        baselineId={data.baseline?.id ?? null}
        currency={currency}
        role={data.profile.role as AppRole}
        thresholds={data.thresholds}
        initialItems={data.items}
        stages={data.stages}
      />

      <BudgetImportPanel projectId={projectId} draftBudgets={data.draftBudgets} canImport={data.canImport} />
    </div>
  )
}
