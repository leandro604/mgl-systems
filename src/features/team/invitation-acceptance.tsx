'use client'

import { useActionState } from 'react'
import { Building2, CheckCircle2, ShieldAlert, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import type { FormActionState } from '@/features/auth/types'
import { initialFormState } from '@/features/auth/types'
import { acceptWorkspaceInvitationAction } from './actions'
import { roleLabels, type MyWorkspaceInvitation } from './types'

export function InvitationAcceptance({ invitation, initialFullName = '' }: { invitation: MyWorkspaceInvitation; initialFullName?: string }) {
  const [state, action] = useActionState<FormActionState, FormData>(acceptWorkspaceInvitationAction, initialFormState)
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Building2 className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invitación de workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{invitation.company_name}</h2>
            <p className="mt-2 text-sm text-slate-400">{invitation.email}</p>
            <div className="mt-3"><Badge>{roleLabels[invitation.role]}</Badge></div>
          </div>
        </div>
      </div>

      {invitation.projects.length > 0 ? (
        <div className="rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Users className="size-4 text-cyan-300" />Proyectos asignados</div>
          <div className="mt-3 space-y-2">{invitation.projects.map((project) => <div key={project.id} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-sm"><span className="text-slate-300">{project.name}</span><span className="text-xs text-slate-500">{project.code}</span></div>)}</div>
        </div>
      ) : null}

      {!invitation.can_transfer ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">Esta cuenta ya tiene un workspace con datos activos.</p><p className="mt-1 text-amber-200/80">MGL Systems no la trasladará automáticamente. Un administrador debe revisar el caso antes de continuar.</p></div>
        </div>
      ) : (
        <form action={action} className="space-y-5">
          <input type="hidden" name="invitation_id" value={invitation.id} />
          <div className="space-y-2"><Label htmlFor="full_name">Nombre completo</Label><Input id="full_name" name="full_name" defaultValue={initialFullName} autoComplete="name" minLength={2} maxLength={150} required /></div>
          {state.message ? <div className={`rounded-xl border p-3 text-sm ${state.status === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{state.message}</div> : null}
          <SubmitButton className="w-full" size="lg" pendingLabel="Uniéndote al workspace..."><CheckCircle2 />Aceptar invitación</SubmitButton>
          <p className="text-xs leading-5 text-slate-500">Si esta cuenta solo tenía un workspace vacío creado durante el registro, se archivará ese workspace y conservarás tu misma cuenta de acceso.</p>
        </form>
      )}
      <Button asChild variant="ghost" className="w-full"><a href="/">Volver</a></Button>
    </div>
  )
}
