'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAuthenticatedUser } from './server'
import type { FormActionState } from './types'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Ingresa tu nombre completo.').max(150),
  legalName: z.string().trim().min(2, 'Ingresa la razón social.').max(200),
  ruc: z.string().trim().regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos.'),
})

export async function bootstrapCompanyAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = schema.safeParse({
    fullName: formData.get('fullName'),
    legalName: formData.get('legalName'),
    ruc: formData.get('ruc'),
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.' }

  const { supabase } = await requireAuthenticatedUser()
  const { error } = await supabase.rpc('bootstrap_company', {
    p_full_name: parsed.data.fullName,
    p_legal_name: parsed.data.legalName,
    p_ruc: parsed.data.ruc,
  })
  if (error) {
    const message = error.code === '23505'
      ? 'Ese RUC ya está aprovisionado en MGL Systems.'
      : 'No pudimos configurar la empresa. Revisa los datos e inténtalo nuevamente.'
    return { status: 'error', message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
