'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { inviteWorkspaceMemberAction } from './actions'
import type { AppRole, InviteMemberState } from './types'

const initial: InviteMemberState = { status: 'idle', message: '' }
const roles: Array<{value:AppRole;label:string}> = [
  {value:'field_worker',label:'Trabajador de campo'},
  {value:'supervisor',label:'Supervisor'},
  {value:'pm',label:'Project Manager'},
  {value:'admin',label:'Administrador'},
]

export function TeamInviteForm({ projects }: { projects: Array<{id:string;code:string;name:string}> }) {
  const [state, action, pending] = useActionState(inviteWorkspaceMemberAction, initial)
  return <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
    <div className="grid gap-3 md:grid-cols-2">
      <Input name="email" type="email" placeholder="Correo" required />
      <select name="role" defaultValue="field_worker" className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm">{roles.map((role)=><option key={role.value} value={role.value}>{role.label}</option>)}</select>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{projects.map((project)=><label key={project.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" name="project_ids" value={project.id} className="size-4 accent-blue-600"/><span className="truncate">{project.code} · {project.name}</span></label>)}</div>
    <div className="flex items-center justify-between gap-3"><span className={`text-sm ${state.status==='error'?'text-red-700':'text-emerald-700'}`}>{state.message}</span><Button type="submit" disabled={pending}>{pending?'Enviando…':'Enviar invitación'}</Button></div>
  </form>
}
