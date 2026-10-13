'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CloudUpload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { DEFAULT_COST_THRESHOLDS, type CostThresholds } from '@/features/budget/cost-calculator'
import { formatMoney } from '@/features/finance/format'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import type { LocalBudgetItem, CostStatus } from '@/lib/db/schema'
import { useSyncStore } from '@/stores/sync-store'
import type { AppRole, BudgetItemRow } from '@/types/domain'
import { hydrateBudgetItemsLocal, toLocalBudgetItem, updateBudgetItemActualLocal } from './repository'

type Stage = { id: string; code: string; name: string; sort_order: number; is_locked: boolean }

type Props = {
  projectId: string
  baselineId: string | null
  currency: string
  role: AppRole
  thresholds: CostThresholds
  initialItems: BudgetItemRow[]
  stages: Stage[]
}

const statusLabel: Record<CostStatus, string> = {
  dentro_presupuesto: 'Dentro',
  alerta_menor: 'Alerta menor',
  alerta_mayor: 'Alerta mayor',
  critico: 'Crítico',
}

const statusVariant: Record<CostStatus, 'success' | 'warning' | 'danger' | 'critical'> = {
  dentro_presupuesto: 'success',
  alerta_menor: 'warning',
  alerta_mayor: 'danger',
  critico: 'critical',
}

const rowTone: Record<CostStatus, string> = {
  dentro_presupuesto: 'bg-white',
  alerta_menor: 'bg-amber-50/50',
  alerta_mayor: 'bg-red-50/45',
  critico: 'bg-red-50',
}

export function filterBudgetItems(
  items: LocalBudgetItem[],
  query: string,
  stageId: string,
  status: CostStatus | 'all',
): LocalBudgetItem[] {
  const needle = query.trim().toLocaleLowerCase('es-PE')
  return items.filter((item) => {
    if (item.deleted_at) return false
    if (stageId !== 'all' && item.stage_id !== stageId) return false
    if (status !== 'all' && item.cost_status !== status) return false
    if (!needle) return true
    return `${item.code} ${item.description} ${item.unit_code}`.toLocaleLowerCase('es-PE').includes(needle)
  })
}

function InlineNumber({ value, disabled, onCommit, ariaLabel }: { value: number; disabled: boolean; onCommit: (value: number) => Promise<void>; ariaLabel: string }) {
  const [draft, setDraft] = useState(String(value))
  const [busy, setBusy] = useState(false)

  useEffect(() => setDraft(String(value)), [value])

  async function commit() {
    const parsed = Number(draft.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value))
      return
    }
    if (parsed === value) return
    setBusy(true)
    try { await onCommit(parsed) } finally { setBusy(false) }
  }

  return (
    <input
      aria-label={ariaLabel}
      type="number"
      min="0"
      step="0.01"
      value={draft}
      disabled={disabled || busy}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.currentTarget.blur() }
        if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur() }
      }}
      className="mt-1 h-9 w-full min-w-0 rounded-md md:mt-0 md:w-28 border border-slate-300 bg-white px-2 text-right text-sm tabular-nums text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-slate-100"
    />
  )
}

export function BudgetItemsTable({ projectId, baselineId, currency, role, thresholds = DEFAULT_COST_THRESHOLDS, initialItems, stages }: Props) {
  const [items, setItems] = useState<LocalBudgetItem[]>(() => initialItems.map(toLocalBudgetItem))
  const [query, setQuery] = useState('')
  const [stageId, setStageId] = useState('all')
  const [status, setStatus] = useState<CostStatus | 'all'>('all')
  const [message, setMessage] = useState('')
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages])

  const refreshLocal = useCallback(async () => {
    if (!baselineId) return
    const { db } = await resolveOperationalRuntime()
    const rows = await db.budgetItems.where('project_id').equals(projectId).toArray()
    setItems(rows.filter((row) => row.budget_id === baselineId && row.deleted_at === null))
  }, [baselineId, projectId])

  useEffect(() => {
    if (!baselineId) return
    void (async () => {
      const { db } = await resolveOperationalRuntime()
      await hydrateBudgetItemsLocal(db, initialItems)
      await refreshLocal()
    })()
  }, [baselineId, initialItems, refreshLocal])

  useEffect(() => { void refreshLocal() }, [lastSyncedAt, refreshLocal])

  const filtered = useMemo(() => filterBudgetItems(items, query, stageId, status), [items, query, stageId, status])
  const leaf = useMemo(() => items.filter((item) => item.item_type === 'item' && !item.deleted_at), [items])
  const totals = useMemo(() => leaf.reduce((acc, item) => ({
    quoted: acc.quoted + Number(item.budget_amount ?? 0),
    actual: acc.actual + Number(item.actual_amount ?? 0),
    committed: acc.committed + Number(item.committed_amount ?? 0),
    executed: acc.executed + Number(item.executed_amount ?? 0),
    available: acc.available + Number(item.available_amount ?? 0),
  }), { quoted: 0, actual: 0, committed: 0, executed: 0, available: 0 }), [leaf])

  async function edit(item: LocalBudgetItem, patch: { qty_actual?: number; unit_price_actual?: number }) {
    setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      const updated = await updateBudgetItemActualLocal(db, identity, item.id, patch, thresholds)
      setItems((current) => current.map((row) => row.id === item.id ? updated : row))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la partida.')
      await refreshLocal()
    }
  }

  if (!baselineId) {
    return <EmptyState title="Sin línea base" />
  }

  const canEditPrice = role !== 'field_worker'

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle>Partidas · cotizado vs. real</CardTitle>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right text-sm sm:grid-cols-3 xl:grid-cols-6">
            <div><p className="text-xs text-slate-500">Cotizado</p><p className="font-semibold text-slate-900">{formatMoney(totals.quoted, currency)}</p></div>
            <div><p className="text-xs text-slate-500">Comprometido</p><p className="font-semibold text-slate-900">{formatMoney(totals.committed, currency)}</p></div>
            <div><p className="text-xs text-slate-500">Ejecutado</p><p className="font-semibold text-slate-900">{formatMoney(totals.executed, currency)}</p></div>
            <div><p className="text-xs text-slate-500">Disponible</p><p className={totals.available < 0 ? 'font-semibold text-red-700' : 'font-semibold text-slate-900'}>{formatMoney(totals.available, currency)}</p></div>
            <div><p className="text-xs text-slate-500">Real</p><p className="font-semibold text-slate-900">{formatMoney(totals.actual, currency)}</p></div>
            <div><p className="text-xs text-slate-500">Δ real</p><p className={totals.actual > totals.quoted ? 'font-semibold text-red-700' : 'font-semibold text-green-700'}>{formatMoney(totals.actual - totals.quoted, currency)}</p></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_auto] xl:items-center">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="Buscar partidas" />
          <select value={stageId} onChange={(event) => setStageId(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900">
            <option value="all">Todas las etapas</option>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.code} · {stage.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            <Chip selected={status === 'all'} onClick={() => setStatus('all')}>Todos</Chip>
            <Chip selected={status === 'alerta_mayor'} onClick={() => setStatus('alerta_mayor')}>Alerta mayor</Chip>
            <Chip selected={status === 'critico'} onClick={() => setStatus('critico')}>Críticos</Chip>
          </div>
        </div>

        {message ? <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><AlertCircle className="size-4" />{message}</div> : null}

        <div className="space-y-3 md:hidden">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Sin resultados</div>
          ) : filtered.map((item) => {
            const isGroup = item.item_type === 'group'
            const stage = stageById.get(item.stage_id)
            return (
              <article key={item.id} className={`rounded-xl border border-slate-200 p-4 ${isGroup ? 'bg-slate-100' : rowTone[item.cost_status]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-blue-700">{item.code}</p>
                    <Link href={`/app/projects/${projectId}/partidas/${item.id}`} className="mt-1 block break-words text-sm font-semibold leading-5 text-slate-900 hover:text-blue-700">{item.description}</Link>
                    <p className="mt-1 text-xs text-slate-500">{stage ? `${stage.code} · ${stage.name}` : 'Sin etapa'}{isGroup ? '' : ` · ${item.unit_code}`}</p>
                  </div>
                  {isGroup ? <Badge variant="neutral" className="shrink-0">Grupo</Badge> : <Badge variant={statusVariant[item.cost_status]} className="shrink-0">{statusLabel[item.cost_status]}</Badge>}
                </div>
                {!isGroup ? (
                  <>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      <div><dt className="text-slate-500">Cotizado</dt><dd className="mt-1 font-semibold tabular-nums text-slate-900">{formatMoney(Number(item.budget_amount ?? 0), currency)}</dd></div>
                      <div><dt className="text-slate-500">Real</dt><dd className="mt-1 font-semibold tabular-nums text-slate-900">{formatMoney(Number(item.actual_amount ?? 0), currency)}</dd></div>
                      <div><dt className="text-slate-500">Comprometido</dt><dd className="mt-1 tabular-nums text-slate-800">{formatMoney(Number(item.committed_amount ?? 0), currency)}</dd></div>
                      <div><dt className="text-slate-500">Disponible</dt><dd className={Number(item.available_amount ?? 0) < 0 ? 'mt-1 font-semibold tabular-nums text-red-700' : 'mt-1 tabular-nums text-slate-800'}>{formatMoney(Number(item.available_amount ?? 0), currency)}</dd></div>
                      <div><dt className="text-slate-500">Metrado cot.</dt><dd className="mt-1 tabular-nums text-slate-800">{Number(item.quantity).toLocaleString('es-PE')}</dd></div>
                      <div><dt className="text-slate-500">Δ real</dt><dd className={Number(item.deviation_pct ?? 0) > 0 ? 'mt-1 font-semibold tabular-nums text-red-700' : 'mt-1 font-semibold tabular-nums text-green-700'}>{item.deviation_pct === null ? '—' : `${Number(item.deviation_pct).toFixed(2)}%`}</dd></div>
                    </dl>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                      <label className="text-xs font-medium text-slate-500">Metrado real<InlineNumber value={Number(item.qty_actual ?? 0)} disabled={false} ariaLabel={`Metrado real ${item.code}`} onCommit={(value) => edit(item, { qty_actual: value })} /></label>
                      <label className="text-xs font-medium text-slate-500">P.U. real<InlineNumber value={Number(item.unit_price_actual ?? 0)} disabled={!canEditPrice} ariaLabel={`Precio real ${item.code}`} onCommit={(value) => edit(item, { unit_price_actual: value })} /></label>
                    </div>
                  </>
                ) : null}
                {(item.pending_sync || item.sync_error) ? <div className="mt-3 flex items-center gap-2 text-xs">{item.pending_sync ? <><CloudUpload className="size-3.5 text-amber-600" /><span className="text-amber-700">Pendiente de sincronizar</span></> : null}{item.sync_error ? <><AlertCircle className="size-3.5 text-red-600" /><span className="text-red-700">Error de sincronización</span></> : null}</div> : null}
              </article>
            )
          })}
        </div>

        <div className="mgl-table-scroll hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
          <table className="min-w-[1620px] text-sm">
            <thead>
              <tr>
                <th>Código</th><th>Partida</th><th>Etapa</th><th>Und.</th>
                <th className="text-right">Metrado cot.</th><th className="text-right">P.U. cot.</th><th className="text-right">Cotizado</th>
                <th className="text-right">Comprometido</th><th className="text-right">Ejecutado</th><th className="text-right">Disponible</th>
                <th className="text-right">Metrado real</th><th className="text-right">P.U. real</th><th className="text-right">Real</th>
                <th className="text-right">Δ %</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={15} className="py-10 text-center text-slate-500">Sin resultados</td></tr>
              ) : filtered.map((item) => {
                const isGroup = item.item_type === 'group'
                const stage = stageById.get(item.stage_id)
                return (
                  <tr key={item.id} className={isGroup ? 'bg-slate-100 font-semibold' : rowTone[item.cost_status]}>
                    <td className="font-mono text-xs text-blue-700">{item.code}</td>
                    <td className="max-w-[320px]"><div className="flex items-center gap-2"><Link href={`/app/projects/${projectId}/partidas/${item.id}`} className="truncate font-medium text-slate-900 hover:text-blue-700">{item.description}</Link>{item.pending_sync ? <CloudUpload className="size-3.5 shrink-0 text-amber-600" aria-label="Pendiente de sincronizar" /> : null}{item.sync_error ? <AlertCircle className="size-3.5 shrink-0 text-red-600" aria-label="Error de sincronización" /> : null}</div></td>
                    <td className="text-xs text-slate-600">{stage ? `${stage.code} · ${stage.name}` : '—'}</td>
                    <td>{isGroup ? '—' : item.unit_code}</td>
                    <td className="text-right tabular-nums">{isGroup ? '—' : Number(item.quantity).toLocaleString('es-PE')}</td>
                    <td className="text-right tabular-nums">{isGroup ? '—' : formatMoney(Number(item.unit_price), currency)}</td>
                    <td className="text-right font-medium tabular-nums">{isGroup ? '—' : formatMoney(Number(item.budget_amount ?? 0), currency)}</td>
                    <td className="text-right tabular-nums">{isGroup ? '—' : formatMoney(Number(item.committed_amount ?? 0), currency)}</td>
                    <td className="text-right tabular-nums">{isGroup ? '—' : formatMoney(Number(item.executed_amount ?? 0), currency)}</td>
                    <td className={Number(item.available_amount ?? 0) < 0 ? 'text-right font-semibold tabular-nums text-red-700' : 'text-right tabular-nums'}>{isGroup ? '—' : formatMoney(Number(item.available_amount ?? 0), currency)}</td>
                    <td className="text-right">{isGroup ? '—' : <InlineNumber value={Number(item.qty_actual ?? 0)} disabled={false} ariaLabel={`Metrado real ${item.code}`} onCommit={(value) => edit(item, { qty_actual: value })} />}</td>
                    <td className="text-right">{isGroup ? '—' : <InlineNumber value={Number(item.unit_price_actual ?? 0)} disabled={!canEditPrice} ariaLabel={`Precio real ${item.code}`} onCommit={(value) => edit(item, { unit_price_actual: value })} />}</td>
                    <td className="text-right font-medium tabular-nums">{isGroup ? '—' : formatMoney(Number(item.actual_amount ?? 0), currency)}</td>
                    <td className={Number(item.deviation_pct ?? 0) > 0 ? 'text-right font-semibold tabular-nums text-red-700' : 'text-right tabular-nums text-green-700'}>{isGroup ? '—' : item.deviation_pct === null ? '—' : `${Number(item.deviation_pct).toFixed(2)}%`}</td>
                    <td>{isGroup ? <Badge variant="neutral">Grupo</Badge> : <Badge variant={statusVariant[item.cost_status]}>{statusLabel[item.cost_status]}</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
