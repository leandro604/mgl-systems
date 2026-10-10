'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarDays, Flag, CalendarRange, Link2, LoaderCircle, Route, Save, Trash2, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { LocalTask, LocalTaskDependency } from '@/lib/db/schema'
import type { TaskDependencyRow, TaskRow } from '@/types/domain'
import { useSyncStore } from '@/stores/sync-store'
import { createDependencyLocal, setDependencyDeletedLocal, updateDependencyLocal, updateTaskLocal } from '@/features/tasks/repository'
import { buildSCurve, weightedActualProgressAt, weightedCurrentProgress, weightedPlannedProgress } from './curve'
import { calculateCpm, taskDurationDays } from './cpm'
import { dependencyLabel, planningHealth, taskTypeLabel } from './format'
import type { PlanningBudgetItem, PlanningMember } from './server'

type Baseline = Database['public']['Tables']['schedule_baselines']['Row']
type BaselineTask = Database['public']['Tables']['schedule_baseline_tasks']['Row']
type BaselineDependency = Database['public']['Tables']['schedule_baseline_dependencies']['Row']
type ProgressRow = Database['public']['Tables']['task_progress_history']['Row']

type Props = {
  projectId: string
  role: string
  initialTasks: TaskRow[]
  initialDependencies: TaskDependencyRow[]
  baseline: Baseline | null
  baselineTasks: BaselineTask[]
  baselineDependencies: BaselineDependency[]
  progressHistory: ProgressRow[]
  budgetItems: PlanningBudgetItem[]
  members: PlanningMember[]
}

const MS_DAY = 86_400_000
const selectClass = 'mt-2 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/70'

function toLocalTask(row: TaskRow): LocalTask {
  return {
    ...row,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  } as LocalTask
}
function toLocalDependency(row: TaskDependencyRow): LocalTaskDependency {
  return { ...row, pending_sync: false, sync_error: null, local_updated_at: row.updated_at }
}
function day(value: string) { return Date.parse(`${value}T00:00:00Z`) }
function pct(value: number) { return `${Math.max(0, Math.min(100, value)).toFixed(1)}%` }
function localIsoDate() {
  const value = new Date()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function PlanningWorkspace({ projectId, role, initialTasks, initialDependencies, baseline, baselineTasks, baselineDependencies, progressHistory, budgetItems, members }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<LocalTask[]>(() => initialTasks.map(toLocalTask))
  const [dependencies, setDependencies] = useState<LocalTaskDependency[]>(() => initialDependencies.map(toLocalDependency))
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
  const canPlan = role === 'admin' || role === 'pm' || role === 'supervisor'
  const canBaseline = role === 'admin' || role === 'pm'

  const refreshLocal = useCallback(async () => {
    const { db } = await resolveOperationalRuntime()
    const [localTasks, localDependencies] = await Promise.all([
      db.tasks.where('project_id').equals(projectId).toArray(),
      db.taskDependencies.where('project_id').equals(projectId).toArray(),
    ])
    if (localTasks.length > 0 || initialTasks.length === 0) setTasks(localTasks.filter((task) => task.deleted_at === null))
    if (localDependencies.length > 0 || initialDependencies.length === 0) setDependencies(localDependencies.filter((dep) => dep.deleted_at === null))
  }, [projectId, initialDependencies.length, initialTasks.length])

  useEffect(() => {
    const handler = () => setOnline(navigator.onLine)
    handler(); window.addEventListener('online', handler); window.addEventListener('offline', handler); void refreshLocal()
    return () => { window.removeEventListener('online', handler); window.removeEventListener('offline', handler) }
  }, [refreshLocal])
  useEffect(() => { void refreshLocal() }, [lastSyncedAt, refreshLocal])

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null
  useEffect(() => { if (!selectedTaskId && tasks[0]) setSelectedTaskId(tasks[0].id) }, [selectedTaskId, tasks])

  const orderedTasks = useMemo(() => [...tasks].sort((a, b) => (a.wbs_code || '999999').localeCompare(b.wbs_code || '999999', undefined, { numeric: true }) || a.position - b.position || a.title.localeCompare(b.title)), [tasks])
  const taskName = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks])
  const memberName = useMemo(() => new Map(members.map((member) => [member.user_id, member.full_name])), [members])
  const baselineByTask = useMemo(() => new Map(baselineTasks.map((task) => [task.task_id, task])), [baselineTasks])
  const cpm = useMemo(() => calculateCpm(tasks, dependencies), [tasks, dependencies])
  const today = localIsoDate()
  const plannedToday = baseline ? weightedPlannedProgress(baselineTasks, today) : 0
  const actualToday = baseline ? (weightedActualProgressAt(baselineTasks, progressHistory, today) ?? weightedCurrentProgress(tasks)) : weightedCurrentProgress(tasks)
  const health = baseline ? planningHealth(plannedToday, actualToday) : { label: 'Sin línea base', className: 'border-slate-700 bg-slate-900 text-slate-400' }
  const curve = useMemo(() => buildSCurve(baselineTasks, progressHistory, today), [baselineTasks, progressHistory, today])
  const overdue = tasks.filter((task) => task.task_type !== 'summary' && task.due_on && task.due_on < today && task.progress < 100).length
  const scheduled = tasks.filter((task) => task.task_type !== 'summary' && task.starts_on && task.due_on)
  const scheduleDates = scheduled.flatMap((task) => [task.starts_on!, task.due_on!])
  const ganttMin = scheduleDates.length ? Math.min(...scheduleDates.map(day)) : day(today)
  const ganttMax = scheduleDates.length ? Math.max(...scheduleDates.map(day)) : ganttMin + MS_DAY
  const ganttSpan = Math.max(MS_DAY, ganttMax - ganttMin + MS_DAY)

  async function saveTaskSchedule(formData: FormData) {
    if (!selectedTask || !canPlan) return
    setBusy(true); setMessage('')
    try {
      const starts = String(formData.get('starts_on') ?? '') || null
      const due = String(formData.get('due_on') ?? '') || null
      const taskType = String(formData.get('task_type') ?? 'activity') as 'activity' | 'milestone' | 'summary'
      if (taskType === 'milestone' && (!starts || due !== starts)) throw new Error('Un hito debe tener la misma fecha de inicio y fin.')
      const { db, identity } = await resolveOperationalRuntime()
      await updateTaskLocal(db, identity, selectedTask.id, {
        wbs_code: String(formData.get('wbs_code') ?? '').trim(),
        task_type: taskType,
        parent_task_id: String(formData.get('parent_task_id') ?? '') || null,
        starts_on: starts,
        due_on: due,
        planned_weight: Number(formData.get('planned_weight') ?? 1),
        budget_item_id: String(formData.get('budget_item_id') ?? '') || null,
      })
      setMessage(online ? 'Planificación guardada localmente y enviada a sincronización.' : 'Planificación guardada sin conexión; se sincronizará después.')
      await refreshLocal()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la planificación.') }
    finally { setBusy(false) }
  }

  async function addDependency(formData: FormData) {
    if (!canPlan) return
    setBusy(true); setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      await createDependencyLocal(db, identity, projectId, {
        task_id: String(formData.get('task_id') ?? ''),
        depends_on_task_id: String(formData.get('depends_on_task_id') ?? ''),
        dependency_type: String(formData.get('dependency_type') ?? 'FS') as 'FS' | 'SS' | 'FF' | 'SF',
        lag_days: Number(formData.get('lag_days') ?? 0),
      })
      await refreshLocal(); setMessage('Dependencia añadida al cronograma.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear la dependencia.') }
    finally { setBusy(false) }
  }

  async function editDependency(dep: LocalTaskDependency, formData: FormData) {
    setBusy(true); setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      await updateDependencyLocal(db, identity, dep.id, {
        dependency_type: String(formData.get('dependency_type') ?? dep.dependency_type) as 'FS' | 'SS' | 'FF' | 'SF',
        lag_days: Number(formData.get('lag_days') ?? dep.lag_days),
      })
      await refreshLocal(); setMessage('Relación CPM actualizada.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la dependencia.') }
    finally { setBusy(false) }
  }

  async function removeDependency(id: string) {
    setBusy(true); setMessage('')
    try { const { db, identity } = await resolveOperationalRuntime(); await setDependencyDeletedLocal(db, identity, id, true); await refreshLocal() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo retirar la dependencia.') }
    finally { setBusy(false) }
  }

  async function createBaseline(formData: FormData) {
    if (!canBaseline) return
    setBusy(true); setMessage('')
    try {
      const name = String(formData.get('baseline_name') ?? '').trim()
      if (name.length < 2) throw new Error('Indica un nombre para la línea base.')
      const { db } = await resolveOperationalRuntime()
      const pending = await db.outbox.where('projectId').equals(projectId).and((item) => item.entity === 'tasks' || item.entity === 'task_dependencies').count()
      if (pending > 0) throw new Error('Primero espera a que las tareas y dependencias pendientes terminen de sincronizarse.')
      const supabase = createClient()
      const { error } = await supabase.rpc('create_schedule_baseline', { p_project_id: projectId, p_name: name })
      if (error) throw error
      setMessage('Nueva línea base creada. La versión anterior quedó conservada como histórica.')
      router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear la línea base.') }
    finally { setBusy(false) }
  }

  const actualLine = curve.filter((point) => point.actual !== null)
  const curveX = (index: number) => curve.length <= 1 ? 0 : index / (curve.length - 1) * 100
  const plannedPoints = curve.map((point, index) => `${curveX(index)},${100 - point.planned}`).join(' ')
  const actualPoints = actualLine.map((point) => `${curveX(curve.indexOf(point))},${100 - (point.actual ?? 0)}`).join(' ')

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Fase 8 · Planificación</p><h2 className="mt-2 text-2xl font-black text-white">Cronograma maestro</h2><p className="mt-2 text-sm text-slate-400">Las fechas y metadatos de planificación siguen usando las mismas tareas local-first del proyecto.</p></div>{baseline ? <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">Línea base V{baseline.version_no} · {baseline.name}</Badge> : <Badge>Sin línea base</Badge>}</div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Programadas</p><p className="mt-2 text-2xl font-black text-white">{scheduled.length}/{tasks.filter((t) => t.task_type !== 'summary').length}</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Ruta crítica</p><p className="mt-2 text-2xl font-black text-red-200">{cpm.criticalTaskIds.length}</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Duración CPM</p><p className="mt-2 text-2xl font-black text-white">{cpm.projectDuration} días</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Atrasadas</p><p className="mt-2 text-2xl font-black text-amber-200">{overdue}</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Plan / real</p><p className="mt-2 text-lg font-black text-white">{pct(plannedToday)} / {pct(actualToday)}</p><Badge className={`mt-2 ${health.className}`}>{health.label}</Badge></CardContent></Card>
    </section>

    {message ? <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">{busy ? <LoaderCircle className="size-4 animate-spin" /> : !online ? <WifiOff className="size-4 text-amber-300" /> : null}{message}</div> : null}

    {canPlan ? <section className="grid gap-5 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>EDT / WBS de la tarea</CardTitle><CardDescription>Código EDT, tipo, jerarquía, fechas, peso y vínculo con presupuesto.</CardDescription></CardHeader><CardContent>
        {tasks.length === 0 ? <p className="text-sm text-slate-500">Primero crea tareas en el módulo Tareas.</p> : <>
          <label className="text-xs font-semibold text-slate-400">Tarea<select value={selectedTask?.id ?? ''} onChange={(event) => setSelectedTaskId(event.target.value)} className={selectClass}>{orderedTasks.map((task) => <option key={task.id} value={task.id}>{task.wbs_code ? `${task.wbs_code} · ` : ''}{task.title}</option>)}</select></label>
          {selectedTask ? <form key={selectedTask.id} action={saveTaskSchedule} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Código WBS</Label><Input name="wbs_code" defaultValue={selectedTask.wbs_code} placeholder="Ej. 01.02.03" /></div><label className="text-xs font-semibold text-slate-400">Tipo<select name="task_type" defaultValue={selectedTask.task_type} className={selectClass}><option value="activity">Actividad</option><option value="milestone">Hito</option><option value="summary">Resumen EDT</option></select></label></div>
            <label className="text-xs font-semibold text-slate-400">Padre EDT<select name="parent_task_id" defaultValue={selectedTask.parent_task_id ?? ''} className={selectClass}><option value="">Sin padre</option>{tasks.filter((task) => task.task_type === 'summary' && task.id !== selectedTask.id).map((task) => <option key={task.id} value={task.id}>{task.wbs_code || '—'} · {task.title}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Inicio planificado</Label><Input name="starts_on" type="date" defaultValue={selectedTask.starts_on ?? ''} /></div><div><Label>Fin planificado</Label><Input name="due_on" type="date" defaultValue={selectedTask.due_on ?? ''} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Peso de planificación</Label><Input name="planned_weight" type="number" min="0" step="0.01" defaultValue={selectedTask.planned_weight} /></div><label className="text-xs font-semibold text-slate-400">Partida presupuestal<select name="budget_item_id" defaultValue={selectedTask.budget_item_id ?? ''} className={selectClass}><option value="">Sin vínculo</option>{budgetItems.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.description}</option>)}</select></label></div>
            <Button type="submit" disabled={busy}><Save />Guardar planificación</Button>
          </form> : null}
        </>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Dependencias CPM</CardTitle><CardDescription>FS, SS, FF y SF con adelanto o retraso en días calendario.</CardDescription></CardHeader><CardContent>
        <form action={addDependency} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-400">Sucesora<select name="task_id" required className={selectClass}><option value="">Seleccionar…</option>{tasks.filter((t) => t.task_type !== 'summary').map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-400">Predecesora<select name="depends_on_task_id" required className={selectClass}><option value="">Seleccionar…</option>{tasks.filter((t) => t.task_type !== 'summary').map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-400">Relación<select name="dependency_type" defaultValue="FS" className={selectClass}>{Object.entries(dependencyLabel).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</select></label>
          <div><Label>Lag (días)</Label><Input name="lag_days" type="number" min="-3650" max="3650" defaultValue="0" /></div>
          <Button type="submit" disabled={busy || tasks.length < 2}><Link2 />Añadir dependencia</Button>
        </form>
        <div className="mt-5 max-h-72 space-y-2 overflow-y-auto">{dependencies.length === 0 ? <p className="text-sm text-slate-500">Sin dependencias activas.</p> : dependencies.map((dep) => <form key={dep.id} action={(fd) => editDependency(dep, fd)} className="grid gap-2 rounded-xl border border-slate-800 p-3 sm:grid-cols-[1fr_120px_90px_auto] sm:items-center"><p className="min-w-0 truncate text-xs text-slate-300"><strong>{taskName.get(dep.depends_on_task_id) ?? 'Tarea'}</strong> → {taskName.get(dep.task_id) ?? 'Tarea'}</p><select name="dependency_type" defaultValue={dep.dependency_type} className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200">{Object.keys(dependencyLabel).map((key) => <option key={key}>{key}</option>)}</select><Input name="lag_days" type="number" defaultValue={dep.lag_days} className="h-9" /><div className="flex"><Button type="submit" variant="ghost" size="icon" title="Guardar"><Save /></Button><Button type="button" variant="ghost" size="icon" title="Retirar" onClick={() => void removeDependency(dep.id)}><Trash2 /></Button></div></form>)}</div>
      </CardContent></Card>
    </section> : null}

    {canBaseline ? <Card><CardHeader><CardTitle>Línea base del cronograma</CardTitle><CardDescription>Captura las tareas, fechas, pesos y dependencias sincronizadas. La versión anterior se conserva para auditoría.</CardDescription></CardHeader><CardContent><form action={createBaseline} className="flex flex-col gap-3 sm:flex-row"><Input name="baseline_name" placeholder={`Ej. Línea base contractual ${new Date().getFullYear()}`} required /><Button type="submit" disabled={busy}><Flag />Crear nueva línea base</Button></form><p className="mt-3 text-xs text-slate-500">Para evitar una fotografía incompleta, MGL bloquea la línea base mientras existan cambios locales de tareas o dependencias pendientes de sincronizar.</p></CardContent></Card> : null}

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarRange className="size-5 text-cyan-300" />Diagrama de Gantt</CardTitle><CardDescription>Barra principal = cronograma actual. Barra fina = línea base activa. Rojo = actividad crítica por CPM.</CardDescription></CardHeader><CardContent className="overflow-x-auto">
      {scheduled.length === 0 ? <p className="text-sm text-slate-500">Asigna fechas a las actividades para construir el Gantt.</p> : <div className="min-w-[900px] space-y-2"><div className="grid grid-cols-[280px_1fr] gap-3 text-[11px] text-slate-500"><span>Actividad</span><div className="flex justify-between"><span>{new Date(ganttMin).toISOString().slice(0,10)}</span><span>{new Date(ganttMax).toISOString().slice(0,10)}</span></div></div>{orderedTasks.filter((task) => task.starts_on && task.due_on).map((task) => { const start = day(task.starts_on!); const finish = day(task.due_on!); const left = (start-ganttMin)/ganttSpan*100; const width = Math.max(task.task_type === 'milestone' ? 0 : 0.8, (finish-start+MS_DAY)/ganttSpan*100); const base=baselineByTask.get(task.id); const metric=cpm.metrics.get(task.id); return <div key={task.id} className="grid grid-cols-[280px_1fr] items-center gap-3 rounded-xl border border-slate-900 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{task.wbs_code ? `${task.wbs_code} · ` : ''}{task.title}</p><p className="mt-1 text-[10px] text-slate-600">{taskTypeLabel[task.task_type] ?? task.task_type} · {taskDurationDays(task)} d · {task.assignee_id ? memberName.get(task.assignee_id) ?? 'Responsable' : 'Sin responsable'}</p></div><div className="relative h-8 rounded-lg bg-slate-950">{base?.starts_on && base.due_on ? <div className="absolute top-2 h-1 rounded-full bg-slate-600" style={{left:`${(day(base.starts_on)-ganttMin)/ganttSpan*100}%`,width:`${Math.max(.6,(day(base.due_on)-day(base.starts_on)+MS_DAY)/ganttSpan*100)}%`}} /> : null}{task.task_type==='milestone' ? <div className={`absolute top-2.5 size-3 rotate-45 ${metric?.critical ? 'bg-red-400' : 'bg-cyan-400'}`} style={{left:`${left}%`}} /> : <div className={`absolute top-3 h-2 rounded-full ${metric?.critical ? 'bg-red-400' : 'bg-cyan-400'}`} style={{left:`${left}%`,width:`${width}%`}} />}<div className="absolute top-3 h-2 rounded-full bg-white/20" style={{left:`${left}%`,width:`${width * Math.min(100,task.progress)/100}%`}} /></div></div>})}</div>}
    </CardContent></Card>

    <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Route className="size-5 text-red-300" />Ruta crítica y holguras</CardTitle><CardDescription>CPM se recalcula en el navegador con las dependencias activas, sin una llamada adicional al servidor.</CardDescription></CardHeader><CardContent className="overflow-x-auto">{cpm.cycleDetected ? <p className="flex items-center gap-2 text-sm text-red-300"><AlertTriangle className="size-4" />Se detectó un ciclo. El servidor también bloquea dependencias cíclicas.</p> : <table className="w-full min-w-[640px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">WBS</th><th>Actividad</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>Holgura</th></tr></thead><tbody className="divide-y divide-slate-800">{orderedTasks.filter((task) => cpm.metrics.has(task.id)).map((task) => { const m=cpm.metrics.get(task.id)!; return <tr key={task.id} className={m.critical ? 'text-red-200' : 'text-slate-300'}><td className="py-2 font-mono text-xs">{task.wbs_code || '—'}</td><td>{task.title}</td><td>{m.earlyStart}</td><td>{m.earlyFinish}</td><td>{m.lateStart}</td><td>{m.lateFinish}</td><td><Badge className={m.critical ? 'border-red-400/20 bg-red-400/10 text-red-200' : ''}>{m.slack} d</Badge></td></tr>})}</tbody></table>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Curva S</CardTitle><CardDescription>Plan de la línea base vs avance real registrado. El historial real se captura automáticamente desde Fase 8.</CardDescription></CardHeader><CardContent>{!baseline || curve.length < 2 ? <p className="text-sm text-slate-500">Crea una línea base para habilitar la Curva S.</p> : <><div className="mb-4 flex flex-wrap gap-3 text-xs"><Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">Plan {pct(plannedToday)}</Badge><Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">Real {pct(actualToday)}</Badge><Badge className={health.className}>Δ {(actualToday-plannedToday).toFixed(1)} pp</Badge></div><svg viewBox="0 0 100 100" role="img" aria-label="Curva S de avance planificado y real" className="h-64 w-full overflow-visible rounded-xl bg-slate-950/70 p-3"><line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" className="text-slate-700" strokeWidth="0.6" /><line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" className="text-slate-800" strokeWidth="0.4" /><line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" className="text-slate-800" strokeWidth="0.4" /><polyline points={plannedPoints} fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="2" vectorEffect="non-scaling-stroke" />{actualPoints ? <polyline points={actualPoints} fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}</svg><div className="mt-2 flex justify-between text-[10px] text-slate-600"><span>{curve[0]?.date}</span><span>{curve.at(-1)?.date}</span></div></>}</CardContent></Card>
    </section>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-cyan-300" />EDT / WBS consolidada</CardTitle><CardDescription>{baseline ? `${baselineTasks.length} tareas y ${baselineDependencies.length} dependencias capturadas en la línea base activa.` : 'La EDT actual todavía no tiene una fotografía de línea base.'}</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">WBS</th><th>Actividad</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Peso</th><th>Avance</th></tr></thead><tbody className="divide-y divide-slate-800">{orderedTasks.map((task) => <tr key={task.id}><td className="py-3 font-mono text-xs text-cyan-200">{task.wbs_code || '—'}</td><td className="font-semibold text-slate-200">{task.title}</td><td>{taskTypeLabel[task.task_type] ?? task.task_type}</td><td>{task.starts_on ?? '—'}</td><td>{task.due_on ?? '—'}</td><td>{Number(task.planned_weight).toLocaleString('es-PE')}</td><td>{task.progress}%</td></tr>)}</tbody></table></CardContent></Card>
  </div>
}
