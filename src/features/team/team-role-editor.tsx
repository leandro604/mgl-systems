'use client'

import { useActionState, useState } from 'react'
import { ShieldCheck, UserCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { initialFormState, type FormActionState } from '@/features/auth/types'
import { updateWorkspaceMemberRoleAction } from './actions'
import { roleLabels, type AppRole } from './types'

const roleHelp: Record<AppRole, string> = {
  admin: 'Acceso administrativo completo',
  pm: 'Gestión de proyectos y finanzas',
  supervisor: 'Supervisión operativa',
  field_worker: 'Interfaz de campo',
}

function roleVariant(role: AppRole): 'info' | 'success' | 'warning' | 'neutral' {
  if (role === 'admin') return 'info'
  if (role === 'pm') return 'success'
  if (role === 'supervisor') return 'warning'
  return 'neutral'
}

export function TeamRoleEditor({
  userId,
  currentUserId,
  role,
  canManage,
}: {
  userId: string
  currentUserId: string
  role: AppRole
  canManage: boolean
}) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(updateWorkspaceMemberRoleAction, initialFormState)
  const [selectedRole, setSelectedRole] = useState<AppRole>(role)
  const isSelf = userId === currentUserId

  if (!canManage || isSelf) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant={roleVariant(role)}>{roleLabels[role]}</Badge>
        {isSelf ? <span className="text-[11px] text-slate-500">Tu cuenta</span> : null}
      </div>
    )
  }

  return (
    <div className="w-full sm:w-auto sm:min-w-[270px]">
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="user_id" value={userId} />
        <select
          name="role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as AppRole)}
          disabled={pending}
          aria-label="Rol del usuario"
          className="h-9 w-full min-w-0 rounded-lg sm:min-w-[160px] border border-slate-300 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50"
        >
          {(Object.keys(roleLabels) as AppRole[]).map((item) => (
            <option key={item} value={item}>{roleLabels[item]}</option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" className="w-full sm:w-auto" disabled={pending || selectedRole === role}>
          {selectedRole === 'admin' ? <ShieldCheck /> : <UserCog />}
          {pending ? 'Guardando...' : 'Guardar'}
        </Button>
      </form>
      <p className="mt-1 text-[11px] text-slate-500">{roleHelp[selectedRole]}</p>
      {state.message ? (
        <p className={`mt-1 text-[11px] ${state.status === 'error' ? 'text-red-600' : 'text-green-700'}`}>{state.message}</p>
      ) : null}
    </div>
  )
}
