'use client'

import { useRef, useState, useTransition } from 'react'
import { FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { importBudgetItemsAction } from './actions'
import { parseBudgetWorkbook } from './excel-import'
import type { BudgetImportParseResult } from './import-types'

type DraftBudget = { id: string; version_no: number; name: string; currency: string; status: string }

type Props = {
  projectId: string
  draftBudgets: DraftBudget[]
  canImport: boolean
}

export function BudgetImportPanel({ projectId, draftBudgets, canImport }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [budgetId, setBudgetId] = useState(draftBudgets[0]?.id ?? '')
  const [parsed, setParsed] = useState<BudgetImportParseResult | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!canImport) return null

  async function onFile(file: File | undefined) {
    setMessage('')
    setParsed(null)
    if (!file) return
    try {
      const result = await parseBudgetWorkbook(file)
      setParsed(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo leer el Excel.')
    }
  }

  function importRows() {
    if (!parsed || !budgetId) return
    if (parsed.errors.length > 0) {
      setMessage('Corrige las observaciones del archivo antes de importar. No se realizará una importación parcial.')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setMessage('La importación de una cotización requiere conexión. La edición de costos reales sí funciona offline.')
      return
    }

    startTransition(async () => {
      const result = await importBudgetItemsAction({ projectId, budgetId, rows: parsed.rows })
      setMessage(result.message)
      if (result.status === 'success') {
        setParsed(null)
        if (inputRef.current) inputRef.current.value = ''
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Importar partidas desde Excel</CardTitle>
            <CardDescription>
              Importa la cotización a una versión en borrador. La línea base y la etapa 98 permanecen inmutables.
            </CardDescription>
          </div>
          <FileSpreadsheet className="size-5 text-blue-600" strokeWidth={1.5} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {draftBudgets.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No existe un presupuesto en borrador. Crea una nueva versión desde <strong>Control</strong> antes de importar.
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-[280px_1fr_auto] lg:items-end">
              <label className="text-xs font-semibold text-slate-700">
                Presupuesto destino
                <select
                  value={budgetId}
                  onChange={(event) => setBudgetId(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  {draftBudgets.map((budget) => (
                    <option key={budget.id} value={budget.id}>V{budget.version_no} · {budget.name}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                Archivo .xlsx
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => void onFile(event.target.files?.[0])}
                  className="mt-2 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
              </label>

              <Button type="button" onClick={importRows} disabled={!parsed?.rows.length || Boolean(parsed?.errors.length) || isPending}>
                {isPending ? <LoaderCircle className="animate-spin" /> : <Upload />}
                Importar
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Columnas reconocidas: Código, Descripción, Unidad, Cantidad/Metrado, Precio unitario, Etapa y Tipo (opcional).
            </p>
          </>
        )}

        {parsed ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Hoja: {parsed.sheetName}</Badge>
              <Badge variant="success">{parsed.rows.length} válidas</Badge>
              {parsed.errors.length ? <Badge variant="warning">{parsed.errors.length} observaciones</Badge> : null}
            </div>
            {parsed.errors.length ? (
              <ul className="max-h-28 list-disc overflow-y-auto pl-5 text-xs text-amber-800">
                {parsed.errors.slice(0, 20).map((error) => <li key={error}>{error}</li>)}
              </ul>
            ) : null}
            {parsed.rows.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] text-xs">
                  <thead><tr><th>Código</th><th>Descripción</th><th>Und.</th><th className="text-right">Metrado</th><th className="text-right">P.U.</th><th>Etapa</th></tr></thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row) => (
                      <tr key={`${row.source_row}-${row.code}`}>
                        <td className="font-mono">{row.code}</td><td>{row.description}</td><td>{row.unit_code}</td>
                        <td className="text-right tabular-nums">{row.quantity}</td><td className="text-right tabular-nums">{row.unit_price}</td><td>{row.stage_code ?? '04'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 5 ? <p className="mt-2 text-xs text-slate-500">Vista previa de las primeras 5 filas.</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
