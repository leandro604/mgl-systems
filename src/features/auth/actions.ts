'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getRequestOrigin } from '@/lib/http/origin'
import { createClient } from '@/lib/supabase/server'
import type { FormActionState } from './types'

const emailSchema = z.string().trim().email('Ingresa un correo válido.').max(254)
const loginPasswordSchema = z.string().min(1, 'Ingresa tu contraseña.').max(128)
const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128)

function errorState(message: string): FormActionState {
  return { status: 'error', message }
}

export async function loginAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const email = emailSchema.safeParse(formData.get('email'))
  const password = loginPasswordSchema.safeParse(formData.get('password'))
  if (!email.success) return errorState(email.error.issues[0]?.message ?? 'Correo inválido.')
  if (!password.success) return errorState(password.error.issues[0]?.message ?? 'Contraseña inválida.')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data })
  if (error) return errorState('No pudimos iniciar sesión. Revisa tus credenciales e inténtalo nuevamente.')

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function registerAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const email = emailSchema.safeParse(formData.get('email'))
  const password = passwordSchema.safeParse(formData.get('password'))
  const confirmation = String(formData.get('passwordConfirmation') ?? '')
  if (!email.success) return errorState(email.error.issues[0]?.message ?? 'Correo inválido.')
  if (!password.success) return errorState(password.error.issues[0]?.message ?? 'Contraseña inválida.')
  if (confirmation !== password.data) return errorState('Las contraseñas no coinciden.')

  const supabase = await createClient()
  const origin = await getRequestOrigin()
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  })

  if (error) return errorState('No pudimos crear la cuenta. Verifica el correo o inténtalo nuevamente en unos minutos.')
  if (data.session) {
    revalidatePath('/', 'layout')
    redirect('/onboarding')
  }

  redirect(`/register/check-email?email=${encodeURIComponent(email.data)}`)
}

export async function forgotPasswordAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const email = emailSchema.safeParse(formData.get('email'))
  if (!email.success) return errorState(email.error.issues[0]?.message ?? 'Correo inválido.')

  const supabase = await createClient()
  const origin = await getRequestOrigin()
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Deliberately generic to avoid account enumeration.
  return { status: 'success', message: 'Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña.' }
}

export async function updatePasswordAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const password = passwordSchema.safeParse(formData.get('password'))
  const confirmation = String(formData.get('passwordConfirmation') ?? '')
  if (!password.success) return errorState(password.error.issues[0]?.message ?? 'Contraseña inválida.')
  if (confirmation !== password.data) return errorState('Las contraseñas no coinciden.')

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) return errorState('La sesión de recuperación expiró. Solicita un nuevo enlace.')

  const { error } = await supabase.auth.updateUser({ password: password.data })
  if (error) return errorState('No pudimos actualizar la contraseña. Solicita un nuevo enlace de recuperación.')

  revalidatePath('/', 'layout')
  redirect('/')
}
