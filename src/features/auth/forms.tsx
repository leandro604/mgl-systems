'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, LogIn, Mail, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { forgotPasswordAction, loginAction, registerAction, updatePasswordAction } from './actions'
import { initialFormState, type FormActionState } from './types'

function Notice({ state }: { state: FormActionState }) {
  if (!state.message) return null
  const success = state.status === 'success'
  return (
    <div role={success ? 'status' : 'alert'} className={cn('flex gap-2 rounded-xl border p-3 text-sm', success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>
      {success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
      <span>{state.message}</span>
    </div>
  )
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialFormState)
  return (
    <form action={action} className="space-y-5">
      <Notice state={state} />
      <div className="space-y-2"><Label htmlFor="email">Correo electrónico</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@empresa.com" required /></div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label htmlFor="password">Contraseña</Label><Link href="/forgot-password" className="text-xs font-medium text-blue-700 hover:text-blue-800">¿Olvidaste tu contraseña?</Link></div>
        <Input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required />
      </div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Ingresando..."><LogIn />Ingresar</SubmitButton>
      <p className="text-center text-sm text-slate-500">¿Primera vez en MGL Systems? <Link href="/register" className="font-semibold text-blue-700 hover:text-blue-800">Crear cuenta</Link></p>
    </form>
  )
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initialFormState)
  return (
    <form action={action} className="space-y-5">
      <Notice state={state} />
      <div className="space-y-2"><Label htmlFor="email">Correo electrónico</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@empresa.com" required /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="password">Contraseña</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
        <div className="space-y-2"><Label htmlFor="passwordConfirmation">Confirmar contraseña</Label><Input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required /></div>
      </div>
      
      <SubmitButton className="w-full" size="lg" pendingLabel="Creando cuenta..."><UserPlus />Crear cuenta</SubmitButton>
      <p className="text-center text-sm text-slate-500">¿Ya tienes una cuenta? <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">Iniciar sesión</Link></p>
    </form>
  )
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState)
  return (
    <form action={action} className="space-y-5">
      <Notice state={state} />
      <div className="space-y-2"><Label htmlFor="email">Correo electrónico</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@empresa.com" required /></div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Enviando..."><Mail />Enviar instrucciones</SubmitButton>
      <Button asChild variant="ghost" className="w-full"><Link href="/login">Volver al inicio de sesión</Link></Button>
    </form>
  )
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialFormState)
  return (
    <form action={action} className="space-y-5">
      <Notice state={state} />
      <div className="space-y-2"><Label htmlFor="password">Nueva contraseña</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      <div className="space-y-2"><Label htmlFor="passwordConfirmation">Confirmar nueva contraseña</Label><Input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required /></div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Actualizando..."><KeyRound />Actualizar contraseña</SubmitButton>
    </form>
  )
}
