'use client'

import { useActionState } from 'react'
import { CheckCircle2, Plus, Power, ReceiptText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from '@/features/auth/types'
import { createFiscalSeriesAction, toggleFiscalSeriesAction } from '@/features/invoices/actions'

type FiscalSeries = {
  id: string
  document_type: string
  series: string
  next_number: number
  active: boolean
  last_issued_at: string | null
  created_at: string
}

function Message({ status, message }: { status: string; message: string }) {
  if (!message) return null
  return (
    <p
      aria-live="polite"
      className={`rounded-xl border p-3 text-sm ${
        status === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {message}
    </p>
  )
}

function documentLabel(type: string) {
  return type === '01' ? 'Factura' : type === '03' ? 'Boleta' : type
}

export function FiscalSeriesManager({ series }: { series: FiscalSeries[] }) {
  const [createState, createAction] = useActionState(createFiscalSeriesAction, initialFormState)
  const [toggleState, toggleAction] = useActionState(toggleFiscalSeriesAction, initialFormState)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <ReceiptText className="size-4 text-blue-600" />
            Nueva serie fiscal
          </h3>
        </div>

        <Message {...createState} />

        <form action={createAction} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="series-document-type">Tipo de comprobante</Label>
            <select
              id="series-document-type"
              name="document_type"
              defaultValue="01"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900"
            >
              <option value="01">Factura (01)</option>
              <option value="03">Boleta (03)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-code">Serie</Label>
            <Input id="series-code" name="series" placeholder="F001" maxLength={4} required className="uppercase" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-next-number">Correlativo inicial</Label>
            <Input id="series-next-number" name="next_number" type="number" min={1} step={1} defaultValue={1} required />
          </div>
          <SubmitButton pendingLabel="Creando serie..." className="w-full md:w-auto">
            <Plus className="size-4" />
            Agregar serie
          </SubmitButton>
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-slate-700">Series configuradas</h3>
            
          </div>
          <Badge variant={series.some((item) => item.active) ? 'success' : 'warning'}>
            {series.filter((item) => item.active).length} activas
          </Badge>
        </div>

        <Message {...toggleState} />

        {series.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <ReceiptText className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 font-medium text-slate-800">Sin series fiscales</p>
            <p className="mt-1 text-sm text-slate-500">Crea F001 para comenzar a numerar facturas de prueba.</p>
          </div>
        ) : (
          <div className="mgl-table-scroll overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Serie</th>
                  <th className="px-4 py-3 font-semibold">Próximo correlativo</th>
                  <th className="px-4 py-3 font-semibold">Última emisión</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {series.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700">{documentLabel(item.document_type)} ({item.document_type})</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.series}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{item.next_number}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.last_issued_at ? new Date(item.last_issued_at).toLocaleString('es-PE') : 'Sin emisiones'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.active ? 'success' : 'neutral'}>
                        {item.active ? <CheckCircle2 className="mr-1 size-3" /> : null}
                        {item.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={toggleAction} className="inline-flex">
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="active" value={item.active ? 'false' : 'true'} />
                        <SubmitButton
                          variant="secondary"
                          size="sm"
                          pendingLabel={item.active ? 'Desactivando...' : 'Activando...'}
                        >
                          <Power className="size-4" />
                          {item.active ? 'Desactivar' : 'Activar'}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
