'use client'

import { useActionState } from 'react'
import { UserMinus, UserPlus } from 'lucide-react'
import { manageProjectMemberAction } from './actions'
import type { FormActionState } from '@/features/auth/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const initial: FormActionState = { status: 'idle', message: '' }
const roles: Record<string, string> = { admin: 'Administrador', pm: 'Project Manager', supervisor: 'Supervisor', field_worker: 'Campo' }

type Profile = { user_id: string; full_name: string; role: string }
type Member = { id: string; user_id: string; profile: Profile | null }

export function ProjectTeamManager({ projectId, currentUserId, members, availableProfiles, canManage }: { projectId: string; currentUserId: string; members: Member[]; availableProfiles: Profile[]; canManage: boolean }) {
  const [state, action, pending] = useActionState(manageProjectMemberAction, initial)
  return (
    <div className="space-y-5">
      {canManage && availableProfiles.length > 0 ? (
        <form action={action} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:flex-row sm:items-end">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="operation" value="add" />
          <label className="flex-1 text-xs font-semibold text-slate-400">Agregar perfil de la empresa
            <select name="user_id" className="mt-2 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" required>
              <option value="">Seleccionar…</option>
              {availableProfiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.full_name} · {roles[profile.role] ?? profile.role}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={pending}><UserPlus />Agregar</Button>
        </form>
      ) : null}

      {state.message ? <p className={`text-sm ${state.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{state.message}</p> : null}

      <div className="divide-y divide-slate-800">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-4 py-4">
            <div className="grid size-10 place-items-center rounded-xl bg-slate-800 text-xs font-bold text-cyan-200">{member.profile?.full_name.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '??'}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{member.profile?.full_name ?? 'Perfil no disponible'}</p><p className="mt-1 text-xs text-slate-500">{member.user_id === currentUserId ? 'Tu membresía' : `Usuario ${member.user_id.slice(0, 8)}…`}</p></div>
            {member.profile ? <Badge>{roles[member.profile.role] ?? member.profile.role}</Badge> : null}
            {canManage && member.user_id !== currentUserId ? (
              <form action={action}>
                <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="user_id" value={member.user_id} /><input type="hidden" name="operation" value="remove" />
                <Button type="submit" variant="ghost" size="icon" disabled={pending} title="Retirar del proyecto"><UserMinus /></Button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
