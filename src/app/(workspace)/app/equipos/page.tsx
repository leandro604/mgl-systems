import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { requireWorkspaceContext } from '@/features/auth/server'
import { TeamExcelImport } from '@/features/team/team-import'
import { TeamInviteForm } from '@/features/team/team-invite-form'
import { TeamRoleEditor } from '@/features/team/team-role-editor'
import type { AppRole } from '@/features/team/types'

export const dynamic = 'force-dynamic'

type TeamRow = {
  user_id: string
  full_name: string
  role: AppRole
  email: string | null
  phone: string | null
  dni: string | null
  position: string | null
  status: string
}

export default async function TeamDirectoryPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const [{ nuevo }, ctx] = await Promise.all([searchParams, requireWorkspaceContext()])
  if (ctx.profile.role === 'field_worker') redirect('/field/hoy')

  const { data, error } = await ctx.supabase.rpc('list_workspace_members')
  if (error) throw error
  const rows = Array.isArray(data) ? data as unknown as TeamRow[] : []
  const isAdmin = ctx.profile.role === 'admin'

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <TeamExcelImport projects={ctx.projects.map(({ id, code, name }) => ({ id, code, name }))} canManage={isAdmin} />
          {isAdmin ? <Button asChild size="sm"><Link href="/app/equipos?nuevo=1"><Plus />Nuevo</Link></Button> : null}
        </div>
      </div>

      {nuevo === '1' && isAdmin ? <TeamInviteForm projects={ctx.projects.map(({ id, code, name }) => ({ id, code, name }))} /> : null}

      {isAdmin ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>Cambio de rol:</strong> el rol es global para la empresa. Al guardarlo, cambia la interfaz y los permisos del usuario en todos sus proyectos. Tu propia cuenta no puede modificarse desde esta pantalla.
        </div>
      ) : null}

      <div className="mgl-table-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{['Nombre', 'Rol', 'Email', 'Teléfono', 'DNI', 'Cargo', 'Estado'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((member) => (
              <tr key={member.user_id} className="align-top">
                <td className="px-4 py-4 font-medium text-slate-900">{member.full_name}</td>
                <td className="px-4 py-3">
                  <TeamRoleEditor
                    userId={member.user_id}
                    currentUserId={ctx.userId}
                    role={member.role}
                    canManage={isAdmin}
                  />
                </td>
                <td className="px-4 py-4">{member.email ?? '—'}</td>
                <td className="px-4 py-4">{member.phone ?? '—'}</td>
                <td className="px-4 py-4">{member.dni ?? '—'}</td>
                <td className="px-4 py-4">{member.position ?? '—'}</td>
                <td className="px-4 py-4"><Badge variant="success">Activo</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <div className="p-8 text-center text-sm text-slate-500">Sin datos</div> : null}
      </div>
    </div>
  )
}
