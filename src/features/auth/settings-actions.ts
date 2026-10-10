'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWorkspaceContext } from './server'
import type { FormActionState } from './types'

export async function updateProfileAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const fullName = z.string().trim().min(2, 'Ingresa tu nombre completo.').max(150).safeParse(formData.get('fullName'))
  if (!fullName.success) return { status: 'error', message: fullName.error.issues[0]?.message ?? 'Nombre inválido.' }
  const { supabase, profile } = await requireWorkspaceContext()
  const { error } = await supabase.from('profiles').update({ full_name: fullName.data, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', profile.id)
  if (error) return { status: 'error', message: 'No pudimos actualizar tu perfil.' }
  revalidatePath('/app', 'layout')
  return { status: 'success', message: 'Perfil actualizado.' }
}

export async function updateCompanyAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const legalName = z.string().trim().min(2, 'Ingresa la razón social.').max(200).safeParse(formData.get('legalName'))
  if (!legalName.success) return { status: 'error', message: legalName.error.issues[0]?.message ?? 'Razón social inválida.' }
  const { supabase, company, profile } = await requireWorkspaceContext()
  if (profile.role !== 'admin') return { status: 'error', message: 'Solo un administrador puede modificar la empresa.' }
  const { error } = await supabase.from('companies').update({ legal_name: legalName.data, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', company.id)
  if (error) return { status: 'error', message: 'No pudimos actualizar la empresa.' }
  revalidatePath('/app', 'layout')
  return { status: 'success', message: 'Empresa actualizada.' }
}
