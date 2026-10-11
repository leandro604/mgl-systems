'use client'

import { useActionState } from 'react'
import { Building2, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { bootstrapCompanyAction } from './onboarding-actions'
import { initialFormState } from './types'

export function OnboardingForm() {
  const [state, action] = useActionState(bootstrapCompanyAction, initialFormState)
  return (
    <form action={action} className="space-y-5">
      {state.message ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{state.message}</div> : null}
      <div className="space-y-2"><Label htmlFor="fullName">Nombre completo</Label><Input id="fullName" name="fullName" autoComplete="name" placeholder="Nombre completo" maxLength={150} required /></div>
      <div className="space-y-2"><Label htmlFor="legalName">Razón social</Label><Input id="legalName" name="legalName" placeholder="MGL Systems S.A.C." maxLength={200} required /></div>
      <div className="space-y-2"><Label htmlFor="ruc">RUC</Label><Input id="ruc" name="ruc" inputMode="numeric" pattern="[0-9]{11}" placeholder="20123456789" minLength={11} maxLength={11} required /></div>
      <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-300" /><span>Este formulario crea una <strong className="text-slate-200">empresa nueva</strong> y te asigna como administrador inicial. Si otra empresa te invitó, usa su enlace de invitación y no crees un workspace adicional.</span></div>
      <SubmitButton size="lg" className="w-full" pendingLabel="Configurando empresa..."><Building2 />Crear workspace</SubmitButton>
    </form>
  )
}
