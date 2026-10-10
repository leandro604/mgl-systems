'use client'

import { useActionState, useState } from 'react'
import { Check, Clipboard, MailPlus, UserCog, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormActionState } from '@/features/auth/types'
import { initialFormState } from '@/features/auth/types'
import { inviteWorkspaceMemberAction, revokeWorkspaceInvitationAction, updateWorkspaceMemberRoleAction } from './actions'
import { roleLabels, type AppRole, type InviteMemberState, type WorkspaceInvitationAdmin } from './types'

const initialInvite: InviteMemberState = { status: 'idle', message: '' }

type Member = { id: string; user_id: string; full_name: string; role: AppRole; created_at: string }
type Project = { id: string; code: string; name: string }

function statusLabel(status: WorkspaceInvitationAdmin['status']) {
  return status === 'pending' ? 'Pendiente' : status === 'accepted' ? 'Aceptada' : status === 'expired' ? 'Vencida' : 'Revocada'
}

function RoleEditor({ member, currentUserId }: { member: Member; currentUserId: string }) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(updateWorkspaceMemberRoleAction, initialFormState)
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="user_id" value={member.user_id} />
        <select name="role" defaultValue={member.role} className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200" disabled={pending}>
          {(Object.keys(roleLabels) as AppRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
        </select>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}><UserCog />Guardar</Button>
      </form>
      {member.user_id === currentUserId ? <span className="text-[11px] text-slate-600">Tu cuenta</span> : null}
      {state.message ? <span className={`max-w-64 text-right text-[11px] ${state.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{state.message}</span> : null}
    </div>
  )
}

function RevokeInvitation({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(revokeWorkspaceInvitationAction, initialFormState)
  return <div className="text-right"><form action={action}><input type="hidden" name="invitation_id" value={id} /><Button type="submit" size="sm" variant="ghost" disabled={pending}><X />Revocar</Button></form>{state.message ? <p className={`mt-1 text-[11px] ${state.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{state.message}</p> : null}</div>
}

export function WorkspaceTeamManager({ members, invitations, projects, currentUserId, canManage, initialProjectId }: { members: Member[]; invitations: WorkspaceInvitationAdmin[]; projects: Project[]; currentUserId: string; canManage: boolean; initialProjectId?: string }) {
  const [inviteState, inviteAction, inviting] = useActionState<InviteMemberState, FormData>(inviteWorkspaceMemberAction, initialInvite)
  const [copied, setCopied] = useState(false)

  async function copyInvite() {
    if (!inviteState.inviteUrl) return
    await navigator.clipboard.writeText(inviteState.inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/45 p-5">
          <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><MailPlus className="size-5" /></span><div><h2 className="text-base font-semibold text-white">Invitar usuario</h2></div></div>
          <form action={inviteAction} className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="invite-email">Correo</Label><Input id="invite-email" name="email" type="email" autoComplete="off" placeholder="persona@empresa.com" required /></div>
              <div className="space-y-2"><Label htmlFor="invite-role">Rol</Label><select id="invite-role" name="role" defaultValue="field_worker" className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{(Object.keys(roleLabels) as AppRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></div>
            </div>
            <div><p className="text-xs font-semibold text-slate-400">Proyectos iniciales</p>{projects.length === 0 ? <p className="mt-2 text-sm text-slate-600">No hay proyectos disponibles.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{projects.map((project) => <label key={project.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-300"><input type="checkbox" name="project_ids" value={project.id} defaultChecked={project.id === initialProjectId} className="size-4 accent-cyan-500" /><span className="min-w-0 flex-1 truncate">{project.name}</span><span className="text-xs text-slate-600">{project.code}</span></label>)}</div>}</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{inviteState.message ? <p className={`text-sm ${inviteState.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{inviteState.message}</p> : null}</div><Button type="submit" disabled={inviting}><MailPlus />{inviting ? 'Enviando...' : 'Enviar invitación'}</Button></div>
          </form>
          {inviteState.inviteUrl ? <div className="mt-4 flex gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3"><code className="min-w-0 flex-1 truncate text-xs text-slate-400">{inviteState.inviteUrl}</code><Button type="button" variant="ghost" size="sm" onClick={copyInvite}>{copied ? <Check /> : <Clipboard />}{copied ? 'Copiado' : 'Copiar'}</Button></div> : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-800">
        <div className="border-b border-slate-800 px-5 py-4"><h2 className="font-semibold text-white">Miembros activos</h2></div>
        <div className="divide-y divide-slate-800">{members.map((member) => <div key={member.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-xs font-bold text-cyan-200">{member.full_name.split(/\s+/).slice(0,2).map((x)=>x[0]).join('').toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{member.full_name}</p><p className="mt-1 text-xs text-slate-600">Usuario {member.user_id.slice(0,8)}…</p></div>{canManage ? <RoleEditor member={member} currentUserId={currentUserId} /> : <Badge>{roleLabels[member.role]}</Badge>}</div>)}</div>
      </section>

      {canManage ? <section className="rounded-xl border border-slate-800"><div className="border-b border-slate-800 px-5 py-4"><h2 className="font-semibold text-white">Invitaciones</h2></div>{invitations.length === 0 ? <p className="p-5 text-sm text-slate-600">Sin datos</p> : <div className="divide-y divide-slate-800">{invitations.map((invite) => <div key={invite.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{invite.email}</p><p className="mt-1 text-xs text-slate-500">{roleLabels[invite.role]}{invite.project_names.length ? ` · ${invite.project_names.join(', ')}` : ' · Sin proyecto inicial'}</p></div><Badge>{statusLabel(invite.status)}</Badge>{invite.status === 'pending' ? <RevokeInvitation id={invite.id} /> : null}</div>)}</div>}</section> : null}

    </div>
  )
}
