'use client'

import { useActionState } from 'react'
import { updateProjectAction } from './actions'
import type { FormActionState } from '@/features/auth/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initial: FormActionState = { status: 'idle', message: '' }

type Project = {
  id: string
  code: string
  name: string
  description: string
  status: string
  starts_on: string | null
  ends_on: string | null
}

export function ProjectSettingsForm({ project }: { project: Project }) {
  const [state, action, pending] = useActionState(updateProjectAction, initial)
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={project.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="code">Código</Label><Input id="code" name="code" defaultValue={project.code} required /></div>
        <div className="space-y-2"><Label htmlFor="name">Nombre</Label><Input id="name" name="name" defaultValue={project.name} required /></div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <textarea id="description" name="description" defaultValue={project.description} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="status">Estado</Label><select id="status" name="status" defaultValue={project.status} className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100"><option value="planning">Planificación</option><option value="active">Activo</option><option value="on_hold">En pausa</option><option value="completed">Completado</option></select></div>
        <div className="space-y-2"><Label htmlFor="starts_on">Inicio</Label><Input id="starts_on" name="starts_on" type="date" defaultValue={project.starts_on ?? ''} /></div>
        <div className="space-y-2"><Label htmlFor="ends_on">Fin</Label><Input id="ends_on" name="ends_on" type="date" defaultValue={project.ends_on ?? ''} /></div>
      </div>
      {state.message ? <p className={`text-sm ${state.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar proyecto'}</Button>
    </form>
  )
}
