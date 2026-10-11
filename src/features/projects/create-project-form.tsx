'use client'

import { useActionState } from 'react'
import { FolderPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from '@/features/auth/types'
import { createProjectAction } from './actions'

export function CreateProjectForm() {
  const [state, action] = useActionState(createProjectAction, initialFormState)
  return (
    <form action={action} className="space-y-4">
      {state.message ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{state.message}</div> : null}
      <div className="grid gap-4 sm:grid-cols-[.65fr_1.35fr]">
        <div className="space-y-2"><Label htmlFor="code">Código</Label><Input id="code" name="code" placeholder="HAC-001" maxLength={40} required /></div>
        <div className="space-y-2"><Label htmlFor="name">Nombre del proyecto</Label><Input id="name" name="name" placeholder="Nombre" maxLength={200} required /></div>
      </div>
      <SubmitButton pendingLabel="Creando proyecto..."><FolderPlus />Crear proyecto</SubmitButton>
    </form>
  )
}
