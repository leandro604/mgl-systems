'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireWorkspaceContext } from '@/features/auth/server'
import { projectCapacityMessage } from '@/features/billing/entitlements'
import type { FormActionState } from '@/features/auth/types'

const createSchema = z.object({
  code: z.string().trim().min(1, 'Ingresa un código.').max(40).regex(/^[A-Za-z0-9_-]+$/, 'Usa letras, números, guion o guion bajo.'),
  name: z.string().trim().min(2, 'Ingresa el nombre del proyecto.').max(200),
})

const updateSchema = z.object({
  project_id: z.string().uuid(),
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000),
  status: z.enum(['planning', 'active', 'on_hold', 'completed']),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.starts_on && value.ends_on && value.ends_on < value.starts_on) {
    ctx.addIssue({ code: 'custom', message: 'La fecha de fin no puede ser anterior al inicio.', path: ['ends_on'] })
  }
})

const memberSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  operation: z.enum(['add', 'remove']),
})

export async function createProjectAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = createSchema.safeParse({ code: formData.get('code'), name: formData.get('name') })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }

  const { supabase, company, profile } = await requireWorkspaceContext()
  if (profile.role !== 'admin' && profile.role !== 'pm') return { status: 'error', message: 'Tu rol no permite crear proyectos.' }

  const capacityMessage = await projectCapacityMessage(company.id)
  if (capacityMessage) return { status: 'error', message: capacityMessage }

  const projectId = crypto.randomUUID()
  const { error } = await supabase.rpc('create_project', {
    p_id: projectId,
    p_company_id: company.id,
    p_code: parsed.data.code.toUpperCase(),
    p_name: parsed.data.name,
  })
  if (error) {
    return { status: 'error', message: error.code === '23505' ? 'El código del proyecto ya existe.' : 'No pudimos crear el proyecto.' }
  }

  revalidatePath('/app', 'layout')
  redirect(`/app/projects/${projectId}`)
}

export async function updateProjectAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = updateSchema.safeParse({
    project_id: formData.get('project_id'),
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description'),
    status: formData.get('status'),
    starts_on: formData.get('starts_on') ?? '',
    ends_on: formData.get('ends_on') ?? '',
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa los datos del proyecto.' }

  const { supabase, profile, projects } = await requireWorkspaceContext()
  if (profile.role !== 'admin' && profile.role !== 'pm') return { status: 'error', message: 'Tu rol no permite editar proyectos.' }
  if (!projects.some((project) => project.id === parsed.data.project_id)) return { status: 'error', message: 'No tienes acceso a este proyecto.' }

  const { error } = await supabase
    .from('projects')
    .update({
      code: parsed.data.code.toUpperCase(),
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
      starts_on: parsed.data.starts_on || null,
      ends_on: parsed.data.ends_on || null,
      updated_at: new Date().toISOString(),
      mutation_id: crypto.randomUUID(),
    })
    .eq('id', parsed.data.project_id)

  if (error) return { status: 'error', message: error.code === '23505' ? 'El código ya está siendo usado.' : error.message }
  revalidatePath('/app', 'layout')
  revalidatePath(`/app/projects/${parsed.data.project_id}`)
  return { status: 'success', message: 'Proyecto actualizado.' }
}

export async function manageProjectMemberAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = memberSchema.safeParse({
    project_id: formData.get('project_id'),
    user_id: formData.get('user_id'),
    operation: formData.get('operation'),
  })
  if (!parsed.success) return { status: 'error', message: 'Datos de membresía inválidos.' }

  const { supabase, company, profile, projects, userId } = await requireWorkspaceContext()
  if (profile.role !== 'admin' && profile.role !== 'pm') return { status: 'error', message: 'Tu rol no permite administrar miembros.' }
  if (!projects.some((project) => project.id === parsed.data.project_id)) return { status: 'error', message: 'No tienes acceso a este proyecto.' }
  if (parsed.data.operation === 'remove' && parsed.data.user_id === userId) return { status: 'error', message: 'No puedes quitarte a ti mismo del proyecto desde esta pantalla.' }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('user_id,deleted_at')
    .eq('company_id', company.id)
    .eq('user_id', parsed.data.user_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (targetError) return { status: 'error', message: targetError.message }
  if (!target) return { status: 'error', message: 'El perfil ya no está activo en la empresa.' }

  const { data: existing, error: existingError } = await supabase
    .from('project_members')
    .select('id,deleted_at')
    .eq('project_id', parsed.data.project_id)
    .eq('user_id', parsed.data.user_id)
    .maybeSingle()
  if (existingError) return { status: 'error', message: existingError.message }

  const version = { updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }
  if (parsed.data.operation === 'add') {
    const result = existing
      ? await supabase.from('project_members').update({ deleted_at: null, ...version }).eq('id', existing.id)
      : await supabase.from('project_members').insert({ company_id: company.id, project_id: parsed.data.project_id, user_id: parsed.data.user_id, ...version })
    if (result.error) return { status: 'error', message: result.error.message }
  } else {
    if (!existing || existing.deleted_at) return { status: 'error', message: 'El usuario ya no pertenece al proyecto.' }
    const { error } = await supabase.from('project_members').update({ deleted_at: new Date().toISOString(), ...version }).eq('id', existing.id)
    if (error) return { status: 'error', message: error.message }
  }

  revalidatePath('/app', 'layout')
  revalidatePath(`/app/projects/${parsed.data.project_id}/team`)
  return { status: 'success', message: parsed.data.operation === 'add' ? 'Miembro agregado al proyecto.' : 'Miembro retirado del proyecto.' }
}
