'use client'

import { useActionState } from 'react'
import { Building2, PackagePlus, Send, Truck, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from '@/features/auth/types'
import { addPurchaseOrderLineAction, createPurchaseOrderAction, createSupplierAction, transitionPurchaseOrderAction } from './actions'

const selectClass = 'flex h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15'
const textareaClass = 'min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15'

function Message({ state }: { state: typeof initialFormState }) {
  if (!state.message) return null
  return <div className={state.status === 'success' ? 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200' : 'rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200'}>{state.message}</div>
}

export function SupplierForm() {
  const [state, action] = useActionState(createSupplierAction, initialFormState)
  return <form action={action} className="space-y-4">
    <Message state={state} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="legal_name">Razón social</Label><Input id="legal_name" name="legal_name" placeholder="Proveedor S.A.C." required /></div>
      <div className="space-y-2"><Label htmlFor="ruc">RUC</Label><Input id="ruc" name="ruc" inputMode="numeric" pattern="[0-9]{11}" maxLength={11} placeholder="20123456789" /></div>
      <div className="space-y-2"><Label htmlFor="contact_name">Contacto</Label><Input id="contact_name" name="contact_name" placeholder="Nombre del contacto" /></div>
      <div className="space-y-2"><Label htmlFor="email">Correo</Label><Input id="email" name="email" type="email" placeholder="compras@proveedor.pe" /></div>
      <div className="space-y-2"><Label htmlFor="phone">Teléfono</Label><Input id="phone" name="phone" placeholder="+51 ..." /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="address">Dirección</Label><Input id="address" name="address" placeholder="Dirección comercial" /></div>
      <div className="space-y-2"><Label htmlFor="currency">Moneda habitual</Label><select id="currency" name="currency" className={selectClass} defaultValue="PEN"><option value="PEN">PEN · Soles</option><option value="USD">USD · Dólares</option></select></div>
    </div>
    <SubmitButton pendingLabel="Guardando proveedor..."><Building2 />Registrar proveedor</SubmitButton>
  </form>
}

export function PurchaseOrderForm({ projectId, suppliers, currency }: { projectId: string; suppliers: Array<{ id: string; legal_name: string; ruc: string | null; currency: string }>; currency: string }) {
  const [state, action] = useActionState(createPurchaseOrderAction, initialFormState)
  const today = new Date().toISOString().slice(0, 10)
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} />
    <Message state={state} />
    {suppliers.length === 0 ? <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">Primero registra un proveedor desde el módulo Compras.</p> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="number">N.º interno de orden</Label><Input id="number" name="number" placeholder="OC-2026-001" required /></div>
      <div className="space-y-2"><Label htmlFor="supplier_id">Proveedor</Label><select id="supplier_id" name="supplier_id" className={selectClass} required defaultValue=""><option value="" disabled>Seleccionar proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.legal_name}{supplier.ruc ? ` · ${supplier.ruc}` : ''}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="currency">Moneda</Label><select id="currency" name="currency" className={selectClass} defaultValue={currency}><option value="PEN">PEN · Soles</option><option value="USD">USD · Dólares</option></select></div>
      <div className="space-y-2"><Label htmlFor="ordered_on">Fecha de orden</Label><Input id="ordered_on" name="ordered_on" type="date" defaultValue={today} required /></div>
      <div className="space-y-2"><Label htmlFor="expected_on">Entrega prevista</Label><Input id="expected_on" name="expected_on" type="date" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notas</Label><textarea id="notes" name="notes" className={textareaClass} placeholder="Condiciones, lugar de entrega, observaciones..." /></div>
    </div>
    <SubmitButton disabled={suppliers.length === 0} pendingLabel="Creando orden..."><PackagePlus />Crear orden de compra</SubmitButton>
  </form>
}

export function PurchaseOrderLineForm({ projectId, orderId, budgetItems = [], materials = [] }: { projectId: string; orderId: string; budgetItems?: Array<{ budget_item_id: string | null; code: string | null; description: string | null; currency: string | null }>; materials?: Array<{ id: string; sku: string; name: string; unit_code: string }> }) {
  const [state, action] = useActionState(addPurchaseOrderLineAction, initialFormState)
  const usable = budgetItems.filter((item): item is { budget_item_id: string; code: string | null; description: string | null; currency: string | null } => Boolean(item.budget_item_id))
  return <form action={action} className="space-y-4">
    <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="order_id" value={orderId} />
    <Message state={state} />
    <div className="space-y-2"><Label htmlFor="budget_item_id">Centro de costo / partida presupuestal</Label><select id="budget_item_id" name="budget_item_id" className={selectClass} defaultValue=""><option value="">Sin asignar</option>{usable.map((item) => <option key={item.budget_item_id} value={item.budget_item_id}>{item.code} · {item.description}</option>)}</select><p className="text-xs text-slate-500">Asignar la partida permite que la orden alimente automáticamente el control presupuestal de Fase 6.</p></div>
    <div className="space-y-2"><Label htmlFor="material_id">Material de almacén</Label><select id="material_id" name="material_id" className={selectClass} defaultValue=""><option value="">No controla stock</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.sku} · {material.name} ({material.unit_code})</option>)}</select><p className="text-xs text-slate-500">Vincúlalo si la partida será recibida físicamente en un almacén durante Fase 7.</p></div>
    <div className="grid gap-4 sm:grid-cols-[1.6fr_.45fr_.55fr_.7fr]">
      <div className="space-y-2"><Label htmlFor="description">Descripción</Label><Input id="description" name="description" placeholder="Material / servicio" required /></div>
      <div className="space-y-2"><Label htmlFor="unit_code">Unidad</Label><Input id="unit_code" name="unit_code" defaultValue="NIU" required /></div>
      <div className="space-y-2"><Label htmlFor="quantity">Cantidad</Label><Input id="quantity" name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required /></div>
      <div className="space-y-2"><Label htmlFor="unit_price">P. unitario sin IGV</Label><Input id="unit_price" name="unit_price" type="number" min="0" step="0.01" required /></div>
    </div>
    <SubmitButton pendingLabel="Agregando..."><PackagePlus />Agregar partida</SubmitButton>
  </form>
}

export function PurchaseOrderTransitionForm({ projectId, orderId, status }: { projectId: string; orderId: string; status: string }) {
  const [state, action] = useActionState(transitionPurchaseOrderAction, initialFormState)
  const targets = status === 'draft' ? [{ value: 'issued', label: 'Emitir orden', icon: Send }, { value: 'cancelled', label: 'Cancelar', icon: XCircle }] : status === 'issued' ? [{ value: 'received', label: 'Registrar recepción', icon: Truck }, { value: 'cancelled', label: 'Cancelar', icon: XCircle }] : []
  if (targets.length === 0) return null
  return <div className="space-y-3"><Message state={state} /><div className="flex flex-wrap gap-2">{targets.map(({ value, label, icon: Icon }) => <form action={action} key={value}><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="target_status" value={value} /><SubmitButton variant={value === 'cancelled' ? 'secondary' : 'default'} pendingLabel="Procesando..."><Icon />{label}</SubmitButton></form>)}</div></div>
}
