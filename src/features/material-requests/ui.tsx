'use client'

import { liveQuery } from 'dexie'
import { ArrowLeft, Check, ChevronRight, PackagePlus, RefreshCw, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { getLocalDb } from '@/lib/db/dexie'
import type { LocalMaterialRequest, LocalMaterialRequestItem } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/client'
import { resolveVerifiedIdentity } from '@/lib/sync/identity'
import {
  addMaterialRequestItemLocal,
  createMaterialRequestLocal,
  transitionMaterialRequestLocal,
} from './repository'
import type { ApproverOption, BudgetOption, MaterialOption, MaterialRequestItemView, MaterialRequestView, StageOption } from './server'

export type ProjectOption = { id: string; code: string; name: string }

export function ApproverSelector({ value, onChange, options }: { value: string; onChange: (id: string) => void; options: ApproverOption[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-blue-500">
      <option value="">Aprobador</option>
      {options.map((option) => <option key={option.user_id} value={option.user_id}>{option.full_name} · {roleLabel(option.role)}</option>)}
    </select>
  )
}

export function BudgetImpactPreview({ total, budget }: { total: number; budget?: BudgetOption | null }) {
  if (!budget) return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Monto estimado <strong className="float-right text-slate-950">S/ {money(total)}</strong></div>
  const available = budget.available_amount ?? Math.max(0, budget.quantity * budget.unit_price - budget.committed_amount - budget.executed_amount)
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <span className="text-slate-500">Estimado</span><strong className="text-right">S/ {money(total)}</strong>
      <span className="text-slate-500">Disponible</span><strong className={`text-right ${total > available ? 'text-red-700' : 'text-slate-950'}`}>S/ {money(available)}</strong>
    </div>
  )
}

type WizardLine = { key: string; materialId: string; quantity: string; unitPrice: string; budgetItemId: string }

export function NewRequestWizard({
  companyId,
  userId,
  projects,
  materials,
  stages,
  budgets,
  approversByProject,
}: {
  companyId: string
  userId: string
  projects: ProjectOption[]
  materials: MaterialOption[]
  stages: StageOption[]
  budgets: BudgetOption[]
  approversByProject: Record<string, ApproverOption[]>
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [neededOn, setNeededOn] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [stageId, setStageId] = useState('')
  const [approverId, setApproverId] = useState('')
  const [budgetItemId, setBudgetItemId] = useState('')
  const [lines, setLines] = useState<WizardLine[]>([{ key: crypto.randomUUID(), materialId: materials[0]?.id ?? '', quantity: '1', unitPrice: '0', budgetItemId: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projectStages = stages.filter((stage) => stage.project_id === projectId)
  const projectBudgets = budgets.filter((item) => item.project_id === projectId && (!stageId || item.stage_id === stageId))
  const approvers = approversByProject[projectId] ?? []
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0)
  const selectedBudget = projectBudgets.find((item) => item.id === budgetItemId) ?? null

  useEffect(() => {
    if (!projectStages.some((stage) => stage.id === stageId)) setStageId(projectStages[0]?.id ?? '')
    if (!approvers.some((person) => person.user_id === approverId)) setApproverId(approvers[0]?.user_id ?? '')
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  function patchLine(key: string, patch: Partial<WizardLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line))
  }

  function canContinue() {
    if (step === 1) return title.trim().length >= 2 && lines.length > 0 && lines.every((line) => line.materialId)
    if (step === 2) return lines.every((line) => Number(line.quantity) > 0 && Number(line.unitPrice) >= 0)
    return Boolean(projectId && stageId && approverId)
  }

  async function submit() {
    if (!canContinue()) return
    setBusy(true); setError(null)
    try {
      const client = createClient()
      const identity = await resolveVerifiedIdentity(client)
      if (!identity || identity.companyId !== companyId || identity.userId !== userId) throw new Error('Sesión inválida')
      const db = getLocalDb(identity)
      const number = `REQ-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${Math.floor(Date.now() % 100000).toString().padStart(5, '0')}`
      const request = await createMaterialRequestLocal(db, identity, projectId, {
        number,
        title,
        notes,
        needed_on: neededOn || null,
        approver_id: approverId,
        priority,
        stage_id: stageId,
        budget_item_id: budgetItemId || null,
      })
      for (const line of lines) {
        await addMaterialRequestItemLocal(db, identity, projectId, {
          request_id: request.id,
          material_id: line.materialId,
          budget_item_id: line.budgetItemId || budgetItemId || null,
          quantity: Number(line.quantity),
          estimated_unit_price: Number(line.unitPrice),
        })
      }
      await transitionMaterialRequestLocal(db, identity, request.id, { transition: 'pending' })
      router.replace(`/field/peticion/${request.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la petición')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">{[1,2,3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />)}</div>
      {step === 1 ? (
        <div className="space-y-4">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="h-14 text-base" />
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={line.key} className="flex gap-2">
                <select value={line.materialId} onChange={(e) => patchLine(line.key, { materialId: e.target.value })} className="h-14 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base">
                  <option value="">Material</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.sku} · {m.name}</option>)}
                </select>
                {lines.length > 1 ? <Button type="button" variant="ghost" size="icon" className="h-14 w-12" onClick={() => setLines((current) => current.filter((x) => x.key !== line.key))}><X /></Button> : null}
                {index === lines.length - 1 ? <Button type="button" variant="secondary" size="icon" className="h-14 w-12" onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), materialId: materials[0]?.id ?? '', quantity: '1', unitPrice: '0', budgetItemId: '' }])}><PackagePlus /></Button> : null}
              </div>
            ))}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className="min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-base outline-none focus:border-blue-500" />
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          {lines.map((line) => {
            const material = materials.find((m) => m.id === line.materialId)
            return <div key={line.key} className="rounded-xl border border-slate-200 bg-white p-4"><p className="font-medium text-slate-950">{material?.name ?? 'Material'}</p><div className="mt-3 grid grid-cols-2 gap-3"><Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => patchLine(line.key,{quantity:e.target.value})} placeholder="Cantidad" className="h-14 text-base"/><Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => patchLine(line.key,{unitPrice:e.target.value})} placeholder="Precio" className="h-14 text-base"/></div></div>
          })}
          <BudgetImpactPreview total={total} budget={null} />
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-4">
          <select value={stageId} onChange={(e) => { setStageId(e.target.value); setBudgetItemId('') }} className="h-14 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"><option value="">Etapa</option>{projectStages.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
          <select value={budgetItemId} onChange={(e) => setBudgetItemId(e.target.value)} className="h-14 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"><option value="">Partida opcional</option>{projectBudgets.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.description}</option>)}</select>
          <ApproverSelector value={approverId} onChange={setApproverId} options={approvers} />
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="h-14 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select>
          <Input type="date" value={neededOn} onChange={(e) => setNeededOn(e.target.value)} className="h-14 text-base" />
          <BudgetImpactPreview total={total} budget={selectedBudget} />
        </div>
      ) : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" className="h-14 text-base" disabled={step === 1 || busy} onClick={() => setStep((v) => Math.max(1, v - 1))}><ArrowLeft /> Atrás</Button>
        {step < 3 ? <Button type="button" className="h-14 text-base" disabled={!canContinue()} onClick={() => setStep((v) => Math.min(3, v + 1))}>Continuar <ChevronRight /></Button> : <Button type="button" className="h-14 text-base" disabled={!canContinue() || busy} onClick={() => void submit()}>{busy ? <RefreshCw className="animate-spin" /> : <Check />} Enviar</Button>}
      </div>
    </div>
  )
}

export function MyRequestsClient({ companyId, userId, projects }: { companyId: string; userId: string; projects: ProjectOption[] }) {
  const [rows, setRows] = useState<LocalMaterialRequest[]>([])
  useEffect(() => {
    const db = getLocalDb({ companyId, userId })
    const subscription = liveQuery(() => db.materialRequests.where('requested_by').equals(userId).toArray()).subscribe((next) => setRows(next.filter((r) => !r.deleted_at).sort((a,b) => b.created_at.localeCompare(a.created_at))))
    return () => subscription.unsubscribe()
  }, [companyId, userId])
  return <div className="space-y-3">{rows.length ? rows.map((row) => <Link key={row.id} href={`/field/peticion/${row.id}`} className="block rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{row.title}</p><p className="mt-1 text-sm text-slate-500">{row.number} · {projects.find((p)=>p.id===row.project_id)?.name ?? 'Proyecto'}</p></div><RequestStatusBadge status={row.workflow_status} /></div>{row.pending_sync ? <p className="mt-3 text-xs font-medium text-amber-700">Pendiente de sincronizar</p> : null}{row.sync_error ? <p className="mt-2 text-xs font-medium text-red-700">{row.sync_error}</p> : null}</Link>) : <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Sin peticiones</div>}</div>
}

export function FieldRequestDetail({ companyId, userId, requestId, materials }: { companyId: string; userId: string; requestId: string; materials: MaterialOption[] }) {
  const [request, setRequest] = useState<LocalMaterialRequest | null>(null)
  const [items, setItems] = useState<LocalMaterialRequestItem[]>([])
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const db = getLocalDb({ companyId, userId })
    const a = liveQuery(() => db.materialRequests.get(requestId)).subscribe((row) => setRequest(row ?? null))
    const b = liveQuery(() => db.materialRequestItems.where('request_id').equals(requestId).toArray()).subscribe((rows) => setItems(rows.filter((r)=>!r.deleted_at)))
    return () => { a.unsubscribe(); b.unsubscribe() }
  }, [companyId,userId,requestId])
  if (!request) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Sin datos</div>
  const total = items.reduce((sum,row)=>sum+Number(row.estimated_amount ?? row.quantity*row.estimated_unit_price),0)
  async function transition(kind:'cancelled'|'delivered') {
    try { const identity=await resolveVerifiedIdentity(createClient()); if(!identity) throw new Error('Sesión inválida'); await transitionMaterialRequestLocal(getLocalDb(identity),identity,requestId,{transition:kind,...(kind==='cancelled'&&reason?{reason}: {})}); setError(null) } catch(cause){setError(cause instanceof Error?cause.message:'No se pudo actualizar')}
  }
  return <div className="space-y-4"><Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>{request.title}</CardTitle><RequestStatusBadge status={request.workflow_status}/></div></CardHeader><CardContent className="space-y-3"><p className="text-sm text-slate-500">{request.number}</p>{items.map((item)=><div key={item.id} className="flex justify-between border-t border-slate-100 pt-3 text-sm"><span>{materials.find((m)=>m.id===item.material_id)?.name ?? 'Material'} · {item.quantity}</span><strong>S/ {money(Number(item.estimated_amount ?? 0))}</strong></div>)}<div className="flex justify-between border-t border-slate-200 pt-3"><span>Total</span><strong>S/ {money(total)}</strong></div>{request.rejection_reason?<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{request.rejection_reason}</p>:null}{request.pending_sync?<p className="text-xs font-medium text-amber-700">Pendiente de sincronizar</p>:null}{request.sync_error?<p className="text-xs font-medium text-red-700">{request.sync_error}</p>:null}</CardContent></Card>{error?<p className="text-sm text-red-700">{error}</p>:null}{['draft','pending','approved'].includes(request.workflow_status)?<div className="space-y-3"><Button variant="secondary" className="h-14 w-full text-base" onClick={()=>void transition('cancelled')}>Cancelar petición</Button></div>:null}</div>
}

export function RequestList({ requests, items, profiles, projects }: { requests: MaterialRequestView[]; items: MaterialRequestItemView[]; profiles: Array<{user_id:string;full_name:string}>; projects: ProjectOption[] }) {
  const [filter,setFilter]=useState('all')
  const rows=filter==='all'?requests:requests.filter((r)=>r.workflow_status===filter)
  const amount=(id:string)=>items.filter((i)=>i.request_id===id).reduce((s,i)=>s+Number(i.estimated_amount ?? i.quantity*i.estimated_unit_price),0)
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{['all','pending','approved','rejected','delivered','cancelled'].map((value)=><Chip key={value} selected={filter===value} onClick={()=>setFilter(value)}>{value==='all'?'Todas':statusLabel(value)}</Chip>)}</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Código','Título','Solicitante','Aprobador','Monto','Estado','Fecha'].map((h)=><th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r)=><tr key={r.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link className="font-medium text-blue-700" href={`/app/peticiones/${r.id}`}>{r.number}</Link></td><td className="px-4 py-3"><p className="font-medium text-slate-900">{r.title}</p><p className="text-xs text-slate-400">{projects.find((p)=>p.id===r.project_id)?.name}</p></td><td className="px-4 py-3">{profiles.find((p)=>p.user_id===r.requested_by)?.full_name ?? '—'}</td><td className="px-4 py-3">{profiles.find((p)=>p.user_id===r.approver_id)?.full_name ?? '—'}</td><td className="px-4 py-3 font-medium">S/ {money(amount(r.id))}</td><td className="px-4 py-3"><RequestStatusBadge status={r.workflow_status}/></td><td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString('es-PE')}</td></tr>)}</tbody></table>{rows.length===0?<div className="p-8 text-center text-sm text-slate-500">Sin datos</div>:null}</div></div>
}

export function RequestDetail({ request, items, materials, profiles, commitments, canApprove, canDeliver }: { request: MaterialRequestView; items: MaterialRequestItemView[]; materials: MaterialOption[]; profiles:Array<{user_id:string;full_name:string}>; commitments:Array<{id:string;amount:number;currency:string;status:string}>; canApprove:boolean; canDeliver:boolean }) {
  const [view,setView]=useState(request); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null)
  const total=items.reduce((s,i)=>s+Number(i.estimated_amount ?? i.quantity*i.estimated_unit_price),0)
  useEffect(()=>{let sub:{unsubscribe:()=>void}|undefined;void (async()=>{const identity=await resolveVerifiedIdentity(createClient());if(!identity)return;const db=getLocalDb(identity);const current=await db.materialRequests.get(request.id);if(!current)await db.materialRequests.put({...request,version:1,pending_sync:false,sync_error:null,local_updated_at:request.updated_at} as unknown as LocalMaterialRequest);sub=liveQuery(()=>db.materialRequests.get(request.id)).subscribe((row)=>{if(row)setView(row as unknown as MaterialRequestView)})})();return()=>sub?.unsubscribe()},[request])
  async function act(transition:'approved'|'rejected'|'delivered'|'cancelled',reason?:string){setBusy(true);setError(null);try{const identity=await resolveVerifiedIdentity(createClient());if(!identity)throw new Error('Sesión inválida');const db=getLocalDb(identity);const row=await transitionMaterialRequestLocal(db,identity,request.id,{transition,...(reason?{reason}: {})});setView(row as unknown as MaterialRequestView)}catch(cause){setError(cause instanceof Error?cause.message:'No se pudo actualizar')}finally{setBusy(false)}}
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{view.title}</CardTitle><p className="mt-1 text-sm text-slate-500">{view.number}</p></div><RequestStatusBadge status={view.workflow_status}/></div></CardHeader><CardContent><div className="divide-y divide-slate-100">{items.map((item)=><div key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium text-slate-900">{materials.find((m)=>m.id===item.material_id)?.name ?? 'Material'}</p><p className="text-xs text-slate-400">{item.quantity} × S/ {money(item.estimated_unit_price)}</p></div><strong>S/ {money(Number(item.estimated_amount ?? 0))}</strong></div>)}</div><div className="mt-4 flex justify-between border-t border-slate-200 pt-4"><span>Total</span><strong>S/ {money(total)}</strong></div>{view.rejection_reason?<p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{view.rejection_reason}</p>:null}</CardContent></Card><div className="space-y-4"><Card><CardContent className="space-y-3 pt-6 text-sm"><Row label="Solicitante" value={profiles.find((p)=>p.user_id===view.requested_by)?.full_name ?? '—'}/><Row label="Aprobador" value={profiles.find((p)=>p.user_id===view.approver_id)?.full_name ?? '—'}/><Row label="Prioridad" value={priorityLabel(view.priority)}/><Row label="Necesario" value={view.needed_on ?? '—'}/>{commitments.map((c)=><Row key={c.id} label="Compromiso" value={`S/ ${money(c.amount)} · ${statusLabel(c.status)}`}/>)}</CardContent></Card>{error?<p className="text-sm text-red-700">{error}</p>:null}{view.workflow_status==='pending'&&canApprove?<><ApproveDialog disabled={busy} onConfirm={()=>void act('approved')}/><RejectDialog disabled={busy} onConfirm={(reason)=>void act('rejected',reason)}/></>:null}{view.workflow_status==='approved'&&canDeliver?<DeliverDialog disabled={busy} onConfirm={()=>void act('delivered')}/>:null}</div></div>
}

export function ApproveDialog({disabled,onConfirm}:{disabled?:boolean;onConfirm:()=>void}){return <Button className="w-full" disabled={disabled} onClick={onConfirm}>Aprobar</Button>}
export function DeliverDialog({disabled,onConfirm}:{disabled?:boolean;onConfirm:()=>void}){return <Button className="w-full" disabled={disabled} onClick={onConfirm}>Marcar entregada</Button>}
export function RejectDialog({disabled,onConfirm}:{disabled?:boolean;onConfirm:(reason:string)=>void}){const[open,setOpen]=useState(false);const[reason,setReason]=useState('');if(!open)return <Button variant="destructive" className="w-full" disabled={disabled} onClick={()=>setOpen(true)}>Rechazar</Button>;return <div className="space-y-2 rounded-xl border border-red-200 bg-white p-3"><textarea value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Motivo" className="min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm"/><div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={!reason.trim()||disabled} onClick={()=>onConfirm(reason.trim())}>Rechazar</Button></div></div>}

export function RequestStatusBadge({status}:{status:string}){const variant=status==='approved'||status==='delivered'?'success':status==='rejected'||status==='cancelled'?'danger':status==='pending'?'warning':'neutral';return <Badge variant={variant}>{statusLabel(status)}</Badge>}
function Row({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-900">{value}</span></div>}
export function money(value:number){return Number(value||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}
export function statusLabel(status:string){return ({draft:'Borrador',pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada',delivered:'Entregada',cancelled:'Cancelada',committed:'Comprometido',executed:'Ejecutado'} as Record<string,string>)[status]??status}
export function priorityLabel(value:string){return ({low:'Baja',normal:'Normal',high:'Alta',urgent:'Urgente'} as Record<string,string>)[value]??value}
function roleLabel(value:string){return ({admin:'Admin',pm:'PM',supervisor:'Supervisor',field_worker:'Campo'} as Record<string,string>)[value]??value}
