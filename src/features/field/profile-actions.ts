'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspaceContext } from '@/features/auth/server'

export async function updateFieldProfileAction(formData: FormData) {
  const { supabase, company, profile } = await requireWorkspaceContext()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const dni = String(formData.get('dni') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const position = String(formData.get('position') ?? '').trim() || null
  const emergencyName = String(formData.get('emergency_contact_name') ?? '').trim() || null
  const emergencyPhone = String(formData.get('emergency_contact_phone') ?? '').trim() || null
  const emergencyRelation = String(formData.get('emergency_contact_relation') ?? '').trim() || null
  if (fullName.length < 2 || fullName.length > 150) throw new Error('Nombre inválido')
  if (dni && !/^\d{8}$/.test(dni)) throw new Error('DNI inválido')
  const { error } = await (supabase as any).from('profiles').update({
    full_name: fullName,
    dni,
    phone,
    position,
    emergency_contact_name: emergencyName,
    emergency_contact_phone: emergencyPhone,
    emergency_contact_relation: emergencyRelation,
    updated_at: new Date().toISOString(),
    mutation_id: crypto.randomUUID(),
  }).eq('company_id', company.id).eq('user_id', profile.user_id).is('deleted_at', null)
  if (error) throw error
  revalidatePath('/field/perfil')
  revalidatePath('/app/equipos')
}
