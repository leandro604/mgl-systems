'use client'

import { useActionState } from 'react'
import { Building2, UserRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from './types'
import { updateCompanyAction, updateProfileAction } from './settings-actions'

function Message({ status, message }: { status: string; message: string }) {
  if (!message) return null
  return <p className={`rounded-xl border p-3 text-sm ${status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>{message}</p>
}

export function ProfileSettingsForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState)
  return <form action={action} className="space-y-4"><Message {...state} /><div className="space-y-2"><Label htmlFor="fullName">Nombre completo</Label><Input id="fullName" name="fullName" defaultValue={fullName} maxLength={150} required /></div><SubmitButton pendingLabel="Guardando..."><UserRound />Guardar perfil</SubmitButton></form>
}

export function CompanySettingsForm({ legalName, ruc, disabled }: { legalName: string; ruc: string; disabled: boolean }) {
  const [state, action] = useActionState(updateCompanyAction, initialFormState)
  return <form action={action} className="space-y-4"><Message {...state} /><div className="space-y-2"><Label htmlFor="legalName">Razón social</Label><Input id="legalName" name="legalName" defaultValue={legalName} maxLength={200} disabled={disabled} required /></div><div className="space-y-2"><Label htmlFor="ruc">RUC</Label><Input id="ruc" value={ruc} disabled /></div><SubmitButton disabled={disabled} pendingLabel="Guardando..."><Building2 />Guardar empresa</SubmitButton></form>
}
