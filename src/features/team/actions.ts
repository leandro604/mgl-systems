'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAuthenticatedUser, requireWorkspaceContext } from '@/features/auth/server'
import { userCapacityMessage } from '@/features/billing/entitlements'
import { getRequestOrigin } from '@/lib/http/origin'
import type { FormActionState } from '@/features/auth/types'
import type { InviteMemberState } from './types'

const emailSchema = z.string().trim().email('Ingresa un correo válido.').max(254)
const roleSchema = z.enum(['admin', 'pm', 'supervisor', 'field_worker'])
const invitationIdSchema = z.string().uuid()

const inviteSchema = z.object({
  email: emailSchema,
  role: roleSchema,
  projectIds: z.array(z.string().uuid()).max(100),
})

const acceptSchema = z.object({
  invitationId: invitationIdSchema,
  fullName: z.string().trim().min(2, 'Ingresa tu nombre completo.').max(150),
})

const roleChangeSchema = z.object({
  userId: z.string().uuid(),
  role: roleSchema,
})

function databaseMessage(message: string): string {
  if (/already an active company member/i.test(message)) return 'Ese correo ya pertenece a un miembro activo de la empresa.'
  if (/only company admins/i.test(message)) return 'Solo un administrador de la empresa puede realizar esta acción.'
  if (/invalid invitation email/i.test(message)) return 'El correo de invitación no es válido.'
  if (/invitation projects are invalid/i.test(message)) return 'Uno de los proyectos seleccionados ya no está disponible.'
  if (/another workspace with active data/i.test(message)) return 'Esta cuenta ya pertenece a otro workspace con datos activos y no puede trasladarse automáticamente.'
  if (/invitation expired/i.test(message)) return 'La invitación venció. Solicita una nueva invitación.'
  if (/belongs to another email/i.test(message)) return 'Esta invitación pertenece a otro correo electrónico.'
  if (/company must keep at least one admin/i.test(message)) return 'La empresa debe conservar al menos un administrador.'
  return 'No pudimos completar la operación. Inténtalo nuevamente.'
}

export async function inviteWorkspaceMemberAction(_previous: InviteMemberState, formData: FormData): Promise<InviteMemberState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
    projectIds: formData.getAll('project_ids'),
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa los datos de la invitación.' }

  const { supabase, profile, company } = await requireWorkspaceContext()
  if (profile.role !== 'admin') return { status: 'error', message: 'Solo un administrador puede invitar usuarios a la empresa.' }
  const capacityMessage = await userCapacityMessage(company.id)
  if (capacityMessage) return { status: 'error', message: capacityMessage }

  const { data, error } = await supabase.rpc('create_workspace_invitation', {
    p_email: parsed.data.email.toLowerCase(),
    p_role: parsed.data.role,
    p_project_ids: parsed.data.projectIds,
  })
  if (error) return { status: 'error', message: databaseMessage(error.message) }

  const invitation = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null
  const invitationId = typeof invitation?.id === 'string' ? invitation.id : null
  if (!invitationId) return { status: 'error', message: 'La invitación se creó, pero no pudimos recuperar su identificador.' }

  const origin = await getRequestOrigin()
  const joinPath = `/join?invitation=${encodeURIComponent(invitationId)}`
  const inviteUrl = `${origin}${joinPath}`
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('next', joinPath)

  const { error: emailError } = await supabase.auth.signInWithOtp({
    email: parsed.data.email.toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: callbackUrl.toString(),
    },
  })

  revalidatePath('/app/team')
  return emailError
    ? { status: 'success', message: 'Invitación creada. El correo automático no pudo enviarse; comparte el enlace manualmente.', inviteUrl }
    : { status: 'success', message: 'Invitación enviada. La persona recibirá un enlace para unirse al workspace.', inviteUrl }
}

export async function revokeWorkspaceInvitationAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = invitationIdSchema.safeParse(formData.get('invitation_id'))
  if (!parsed.success) return { status: 'error', message: 'Invitación inválida.' }
  const { supabase, profile } = await requireWorkspaceContext()
  if (profile.role !== 'admin') return { status: 'error', message: 'Solo un administrador puede revocar invitaciones.' }
  const { error } = await supabase.rpc('revoke_workspace_invitation', { p_invitation_id: parsed.data })
  if (error) return { status: 'error', message: databaseMessage(error.message) }
  revalidatePath('/app/team')
  return { status: 'success', message: 'Invitación revocada.' }
}

export async function updateWorkspaceMemberRoleAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = roleChangeSchema.safeParse({ userId: formData.get('user_id'), role: formData.get('role') })
  if (!parsed.success) return { status: 'error', message: 'Datos de rol inválidos.' }
  const { supabase, profile } = await requireWorkspaceContext()
  if (profile.role !== 'admin') return { status: 'error', message: 'Solo un administrador puede cambiar roles.' }
  if (parsed.data.userId === profile.user_id) return { status: 'error', message: 'Por seguridad, cambia el rol de otros usuarios; tu propio rol no se modifica desde Equipo.' }
  const { error } = await supabase.rpc('update_workspace_member_role', { p_user_id: parsed.data.userId, p_role: parsed.data.role })
  if (error) return { status: 'error', message: databaseMessage(error.message) }
  revalidatePath('/app', 'layout')
  revalidatePath('/app/team')
  revalidatePath('/app/equipos')
  return { status: 'success', message: 'Rol actualizado. El nuevo acceso se aplicará en la próxima navegación del usuario.' }
}

export async function acceptWorkspaceInvitationAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = acceptSchema.safeParse({ invitationId: formData.get('invitation_id'), fullName: formData.get('full_name') })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }

  const { supabase } = await requireAuthenticatedUser()
  const { error } = await supabase.rpc('accept_workspace_invitation', {
    p_invitation_id: parsed.data.invitationId,
    p_full_name: parsed.data.fullName,
  })
  if (error) return { status: 'error', message: databaseMessage(error.message) }

  revalidatePath('/', 'layout')
  redirect('/')
}
