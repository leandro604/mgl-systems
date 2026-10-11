'use client'

import { useActionState } from 'react'
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Building2, CheckCircle2, ClipboardPlus, PackageMinus, PackagePlus, Send, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from '@/features/auth/types'
import {
  addMaterialRequestLineAction,
  createMaterialAction,
  createMaterialRequestAction,
  createWarehouseAction,
  issueRequestAction,
  manualIssueAction,
  manualReceiptAction,
  receivePurchaseAction,
  transferStockAction,
  transitionMaterialRequestAction,
} from './actions'

const selectClass = 'flex h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15'
const textareaClass = 'min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15'

type MaterialOption = { id: string; sku: string; name: string; unit_code: string }
type WarehouseOption = { id: string; code: string; name: string }
type BudgetOption = { budget_item_id: string | null; code: string | null; description: string | null; unit_code: string | null }
type ProfileOption = { user_id: string; full_name: string; role: string }
type IssueOption = { request_item_id: string; request_number: string; material_name: string; remaining_quantity: number; unit_code: string }
type PurchaseOption = { purchase_order_item_id: string; order_number: string; material_name: string; description: string; remaining_quantity: number; unit_code: string }

function Message({ state }: { state: typeof initialFormState }) {
  if (!state.message) return null
  return <div className={state.status === 'success' ? 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200' : 'rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200'}>{state.message}</div>
}

export function MaterialForm() {
  const [state, action] = useActionState(createMaterialAction, initialFormState)
  return <form action={action} className="space-y-4">
    <Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="sku">SKU / código</Label><Input id="sku" name="sku" placeholder="MAT-001" required /></div>
      <div className="space-y-2"><Label htmlFor="unit_code">Unidad</Label><Input id="unit_code" name="unit_code" defaultValue="NIU" required /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="name">Material</Label><Input id="name" name="name" placeholder="Material" required /></div>
      <div className="space-y-2"><Label htmlFor="category">Categoría</Label><Input id="category" name="category" placeholder="Categoría" /></div>
      <div className="space-y-2"><Label htmlFor="min_stock">Stock mínimo</Label><Input id="min_stock" name="min_stock" type="number" min="0" step="0.0001" defaultValue="0" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notas</Label><textarea id="notes" name="notes" className={textareaClass} /></div>
    </div>
    <SubmitButton pendingLabel="Guardando material..."><PackagePlus />Registrar material</SubmitButton>
  </form>
}

export function WarehouseForm({ projectId, profiles }: { projectId: string; profiles: ProfileOption[] }) {
  const [state, action] = useActionState(createWarehouseAction, initialFormState)
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} />
    <Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="code">Código</Label><Input id="code" name="code" placeholder="ALM-OBRA" required /></div>
      <div className="space-y-2"><Label htmlFor="name">Nombre</Label><Input id="name" name="name" placeholder="Nombre" required /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="location">Ubicación</Label><Input id="location" name="location" placeholder="Ubicación" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="responsible_id">Responsable</Label><select id="responsible_id" name="responsible_id" className={selectClass} defaultValue=""><option value="">Sin responsable asignado</option>{profiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.full_name} · {profile.role}</option>)}</select></div>
    </div>
    <SubmitButton pendingLabel="Creando almacén..."><Building2 />Crear almacén</SubmitButton>
  </form>
}

export function MaterialRequestForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(createMaterialRequestAction, initialFormState)
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} />
    <Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="number">N.º requerimiento</Label><Input id="number" name="number" placeholder="REQ-2026-001" required /></div>
      <div className="space-y-2"><Label htmlFor="needed_on">Necesario para</Label><Input id="needed_on" name="needed_on" type="date" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Motivo / frente de trabajo</Label><textarea id="notes" name="notes" className={textareaClass} placeholder="Motivo" /></div>
    </div>
    <SubmitButton pendingLabel="Creando requerimiento..."><ClipboardPlus />Crear requerimiento</SubmitButton>
  </form>
}

export function MaterialRequestLineForm({ projectId, requestId, materials, budgetItems }: { projectId: string; requestId: string; materials: MaterialOption[]; budgetItems: BudgetOption[] }) {
  const [state, action] = useActionState(addMaterialRequestLineAction, initialFormState)
  const usableBudgets = budgetItems.filter((item): item is BudgetOption & { budget_item_id: string } => Boolean(item.budget_item_id))
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="request_id" value={requestId} />
    <Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="material_id">Material</Label><select id="material_id" name="material_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar material</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.sku} · {material.name} ({material.unit_code})</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="quantity">Cantidad</Label><Input id="quantity" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required /></div>
      <div className="space-y-2"><Label htmlFor="budget_item_id">Centro de costo</Label><select id="budget_item_id" name="budget_item_id" className={selectClass} defaultValue=""><option value="">Sin asignar</option>{usableBudgets.map((item) => <option key={item.budget_item_id} value={item.budget_item_id}>{item.code} · {item.description}</option>)}</select></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Observación</Label><Input id="notes" name="notes" placeholder="Observación" /></div>
    </div>
    <SubmitButton disabled={materials.length === 0} pendingLabel="Agregando..."><PackagePlus />Agregar material</SubmitButton>
  </form>
}

export function MaterialRequestTransitionForm({ projectId, requestId, status, canManage, isRequester }: { projectId: string; requestId: string; status: string; canManage: boolean; isRequester: boolean }) {
  const [state, action] = useActionState(transitionMaterialRequestAction, initialFormState)
  const targets: Array<{ value: 'submitted' | 'approved' | 'rejected' | 'cancelled'; label: string; icon: typeof Send; variant?: 'default' | 'secondary' }> = []
  if (status === 'draft' && (isRequester || canManage)) targets.push({ value: 'submitted', label: 'Enviar requerimiento', icon: Send })
  if (status === 'submitted' && canManage) targets.push({ value: 'approved', label: 'Aprobar', icon: CheckCircle2 }, { value: 'rejected', label: 'Rechazar', icon: XCircle, variant: 'secondary' })
  if (['draft', 'submitted', 'approved'].includes(status) && (isRequester || canManage)) targets.push({ value: 'cancelled', label: 'Cancelar', icon: XCircle, variant: 'secondary' })
  if (targets.length === 0) return null
  return <div className="space-y-3"><Message state={state} /><div className="flex flex-wrap gap-2">{targets.map(({ value, label, icon: Icon, variant }) => <form action={action} key={value}><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="target_status" value={value} /><SubmitButton variant={variant ?? 'default'} pendingLabel="Procesando..."><Icon />{label}</SubmitButton></form>)}</div></div>
}

export function ManualReceiptForm({ projectId, warehouses, materials }: { projectId: string; warehouses: WarehouseOption[]; materials: MaterialOption[] }) {
  const [state, action] = useActionState(manualReceiptAction, initialFormState)
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>Almacén destino</Label><select name="warehouse_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Material</Label><select name="material_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.sku} · {m.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Cantidad</Label><Input name="quantity" type="number" min="0.0001" step="0.0001" required /></div>
      <div className="space-y-2"><Label>Costo unitario sin IGV</Label><Input name="unit_cost" type="number" min="0" step="0.0001" required /></div>
      <div className="space-y-2 sm:col-span-2"><Label>Notas</Label><Input name="notes" placeholder="Notas" /></div>
    </div><SubmitButton disabled={!warehouses.length || !materials.length} pendingLabel="Registrando ingreso..."><ArrowDownToLine />Registrar ingreso</SubmitButton></form>
}

export function ManualIssueForm({ projectId, warehouses, materials }: { projectId: string; warehouses: WarehouseOption[]; materials: MaterialOption[] }) {
  const [state, action] = useActionState(manualIssueAction, initialFormState)
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>Almacén origen</Label><select name="warehouse_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Material</Label><select name="material_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.sku} · {m.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Cantidad</Label><Input name="quantity" type="number" min="0.0001" step="0.0001" required /></div>
      <div className="space-y-2"><Label>Motivo</Label><Input name="notes" placeholder="Motivo" required /></div>
    </div><SubmitButton disabled={!warehouses.length || !materials.length} pendingLabel="Registrando ajuste..."><PackageMinus />Registrar salida</SubmitButton></form>
}

export function RequestIssueForm({ projectId, warehouses, options }: { projectId: string; warehouses: WarehouseOption[]; options: IssueOption[] }) {
  const [state, action] = useActionState(issueRequestAction, initialFormState)
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>Almacén origen</Label><select name="source_warehouse_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Requerimiento pendiente</Label><select name="request_item_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{options.map((o) => <option key={o.request_item_id} value={o.request_item_id}>{o.request_number} · {o.material_name} · pendiente {o.remaining_quantity} {o.unit_code}</option>)}</select></div>
      <div className="space-y-2"><Label>Cantidad a entregar</Label><Input name="quantity" type="number" min="0.0001" step="0.0001" required /></div>
      <div className="space-y-2"><Label>Notas</Label><Input name="notes" placeholder="Notas" /></div>
    </div><SubmitButton disabled={!warehouses.length || !options.length} pendingLabel="Registrando salida..."><ArrowUpFromLine />Entregar material</SubmitButton></form>
}

export function TransferForm({ projectId, warehouses, materials }: { projectId: string; warehouses: WarehouseOption[]; materials: MaterialOption[] }) {
  const [state, action] = useActionState(transferStockAction, initialFormState)
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>Origen</Label><select name="source_warehouse_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Destino</Label><select name="target_warehouse_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Material</Label><select name="material_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.sku} · {m.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Cantidad</Label><Input name="quantity" type="number" min="0.0001" step="0.0001" required /></div>
      <div className="space-y-2 sm:col-span-2"><Label>Notas</Label><Input name="notes" placeholder="Motivo" /></div>
    </div><SubmitButton disabled={warehouses.length < 2 || !materials.length} pendingLabel="Transfiriendo..."><ArrowRightLeft />Transferir stock</SubmitButton></form>
}

export function PurchaseReceiptForm({ projectId, warehouses, options }: { projectId: string; warehouses: WarehouseOption[]; options: PurchaseOption[] }) {
  const [state, action] = useActionState(receivePurchaseAction, initialFormState)
  return <form action={action} className="space-y-4"><input type="hidden" name="project_id" value={projectId} /><Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>Almacén destino</Label><select name="target_warehouse_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Partida de OC</Label><select name="purchase_order_item_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar</option>{options.map((o) => <option key={o.purchase_order_item_id} value={o.purchase_order_item_id}>{o.order_number} · {o.material_name} · OC {o.remaining_quantity} {o.unit_code}</option>)}</select></div>
      <div className="space-y-2"><Label>Cantidad recibida</Label><Input name="quantity" type="number" min="0.0001" step="0.0001" required /></div>
      <div className="space-y-2"><Label>Notas</Label><Input name="notes" placeholder="Notas" /></div>
    </div><SubmitButton disabled={!warehouses.length || !options.length} pendingLabel="Registrando recepción..."><ArrowDownToLine />Recibir compra</SubmitButton></form>
}
