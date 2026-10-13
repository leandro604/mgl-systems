'use client'

import { useActionState } from 'react'
import { Activity, CheckCircle2, CircleDollarSign, Layers3, Plus, Send, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from '@/features/auth/types'
import { activateBudgetAction, addBudgetItemAction, addValuationLineAction, createBudgetAction, createValuationAction, recordProgressAction, transitionValuationAction } from './actions'

const selectClass = 'flex h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15'
const textareaClass = 'min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15'

function Message({ state }: { state: typeof initialFormState }) {
  if (!state.message) return null
  return <div className={state.status === 'success' ? 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200' : 'rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200'}>{state.message}</div>
}

export function BudgetCreateForm({ projectId, currency }: { projectId: string; currency: string }) {
  const [state, action] = useActionState(createBudgetAction, initialFormState)
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} /><Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="budget_name">Nombre</Label><Input id="budget_name" name="name" placeholder="Nombre" required /></div>
      <div className="space-y-2"><Label htmlFor="budget_currency">Moneda</Label><select id="budget_currency" name="currency" className={selectClass} defaultValue={currency}><option value="PEN">PEN · Soles</option><option value="USD">USD · Dólares</option></select></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="budget_notes">Notas</Label><textarea id="budget_notes" name="notes" className={textareaClass} placeholder="Notas" /></div>
    </div>
    <SubmitButton pendingLabel="Creando versión..."><Layers3 />Crear versión</SubmitButton>
  </form>
}

export function BudgetItemForm({ projectId, budgetId, groups }: { projectId: string; budgetId: string; groups: Array<{ id: string; code: string; description: string }> }) {
  const [state, action] = useActionState(addBudgetItemAction, initialFormState)
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="budget_id" value={budgetId} /><Message state={state} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="item_type">Tipo</Label><select id="item_type" name="item_type" className={selectClass} defaultValue="item"><option value="item">Partida</option><option value="group">Grupo / capítulo</option></select></div>
      <div className="space-y-2"><Label htmlFor="parent_id">Grupo padre</Label><select id="parent_id" name="parent_id" className={selectClass} defaultValue=""><option value="">Sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.description}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="item_code">Código</Label><Input id="item_code" name="code" placeholder="07.01.03" required /></div>
      <div className="space-y-2"><Label htmlFor="sort_order">Orden</Label><Input id="sort_order" name="sort_order" type="number" min="0" defaultValue="0" /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="item_description">Descripción</Label><Input id="item_description" name="description" placeholder="Descripción" required /></div>
      <div className="space-y-2"><Label htmlFor="unit_code">Unidad</Label><Input id="unit_code" name="unit_code" defaultValue="NIU" /></div>
      <div className="space-y-2"><Label htmlFor="quantity">Metrado</Label><Input id="quantity" name="quantity" type="number" min="0" step="0.0001" defaultValue="1" /></div>
      <div className="space-y-2"><Label htmlFor="unit_price">P.U. sin IGV</Label><Input id="unit_price" name="unit_price" type="number" min="0" step="0.0001" defaultValue="0" /></div>
    </div>
    
    <SubmitButton pendingLabel="Agregando..."><Plus />Agregar al presupuesto</SubmitButton>
  </form>
}

export function ActivateBudgetForm({ projectId, budgetId }: { projectId: string; budgetId: string }) {
  const [state, action] = useActionState(activateBudgetAction, initialFormState)
  return <div className="space-y-3"><Message state={state} /><form action={action}><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="budget_id" value={budgetId} /><SubmitButton pendingLabel="Fijando línea base..."><CheckCircle2 />Establecer como línea base</SubmitButton></form></div>
}

export function ProgressForm({ projectId, items, today }: { projectId: string; items: Array<{ budget_item_id: string | null; code: string | null; description: string | null; unit_code: string | null }>; today: string }) {
  const [state, action] = useActionState(recordProgressAction, initialFormState)
  const usable = items.filter((item): item is { budget_item_id: string; code: string | null; description: string | null; unit_code: string | null } => Boolean(item.budget_item_id))
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><Message state={state} />
    <div className="grid gap-4 md:grid-cols-[1.5fr_.55fr_.55fr]">
      <div className="space-y-2"><Label htmlFor="progress_item">Partida</Label><select id="progress_item" name="budget_item_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar partida</option>{usable.map((item) => <option key={item.budget_item_id} value={item.budget_item_id}>{item.code} · {item.description} ({item.unit_code})</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="progress_quantity">Metrado ejecutado</Label><Input id="progress_quantity" name="quantity" type="number" min="0.0001" step="0.0001" required /></div>
      <div className="space-y-2"><Label htmlFor="progress_on">Fecha</Label><Input id="progress_on" name="progress_on" type="date" defaultValue={today} required /></div>
      <div className="space-y-2 md:col-span-3"><Label htmlFor="progress_notes">Sustento / observación</Label><Input id="progress_notes" name="notes" placeholder="Observación" /></div>
    </div>
    <SubmitButton disabled={usable.length === 0} pendingLabel="Registrando..."><Activity />Registrar avance</SubmitButton>
  </form>
}

export function ValuationForm({ projectId, budgetId, nextNumber }: { projectId: string; budgetId: string; nextNumber: number }) {
  const [state, action] = useActionState(createValuationAction, initialFormState)
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="budget_id" value={budgetId} /><Message state={state} />
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="valuation_number">N.º valorización</Label><Input id="valuation_number" name="number" type="number" min="1" defaultValue={nextNumber} required /></div>
      <div className="space-y-2"><Label htmlFor="period_start">Inicio</Label><Input id="period_start" name="period_start" type="date" required /></div>
      <div className="space-y-2"><Label htmlFor="period_end">Fin</Label><Input id="period_end" name="period_end" type="date" required /></div>
      <div className="space-y-2 sm:col-span-3"><Label htmlFor="valuation_notes">Notas</Label><Input id="valuation_notes" name="notes" placeholder="Notas" /></div>
    </div><SubmitButton pendingLabel="Creando valorización..."><CircleDollarSign />Crear valorización</SubmitButton>
  </form>
}

export function ValuationLineForm({ projectId, valuationId, items }: { projectId: string; valuationId: string; items: Array<{ id: string; code: string; description: string; unit_code: string; unit_price: number }> }) {
  const [state, action] = useActionState(addValuationLineAction, initialFormState)
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="valuation_id" value={valuationId} /><Message state={state} />
    <div className="grid gap-4 md:grid-cols-[1.7fr_.55fr]">
      <div className="space-y-2"><Label htmlFor="valuation_item">Partida</Label><select id="valuation_item" name="budget_item_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar partida</option>{items.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.description} · {item.unit_code}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="valuation_quantity">Metrado del periodo</Label><Input id="valuation_quantity" name="quantity" type="number" min="0.0001" step="0.0001" required /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="valuation_line_notes">Observación</Label><Input id="valuation_line_notes" name="notes" placeholder="Observación" /></div>
    </div><SubmitButton disabled={items.length === 0} pendingLabel="Agregando..."><Plus />Agregar partida valorizada</SubmitButton>
  </form>
}

export function ValuationTransitionForm({ projectId, valuationId, status }: { projectId: string; valuationId: string; status: string }) {
  const [state, action] = useActionState(transitionValuationAction, initialFormState)
  const targets = status === 'draft'
    ? [{ value: 'submitted', label: 'Presentar valorización', icon: Send }]
    : status === 'submitted'
      ? [{ value: 'approved', label: 'Aprobar', icon: CheckCircle2 }, { value: 'observed', label: 'Observar', icon: TriangleAlert }]
      : status === 'observed'
        ? [{ value: 'submitted', label: 'Volver a presentar', icon: Send }]
        : []
  if (targets.length === 0) return null
  return <div className="space-y-3"><Message state={state} /><div className="flex flex-wrap gap-2">{targets.map(({ value, label, icon: Icon }) => <form key={value} action={action}><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="valuation_id" value={valuationId} /><input type="hidden" name="target_status" value={value} /><SubmitButton variant={value === 'observed' ? 'secondary' : 'default'} pendingLabel="Procesando..."><Icon />{label}</SubmitButton></form>)}</div></div>
}
