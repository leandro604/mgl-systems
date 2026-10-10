import Link from 'next/link'
import { PlugZap, ReceiptText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanySettingsForm, ProfileSettingsForm } from '@/features/auth/settings-forms'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canConfigureCompany } from '@/features/auth/roles'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { profile, company } = await requireWorkspaceContext()
  const isAdmin = canConfigureCompany(profile.role)
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
          <p className="mt-1 text-sm text-slate-500">Tu perfil y las herramientas disponibles para tu rol.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/configuracion/integraciones" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800"><PlugZap className="size-4"/>Integraciones</Link>
          {isAdmin ? <Link href="/app/configuracion/facturacion" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800"><ReceiptText className="size-4"/>Facturación electrónica</Link> : null}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Mi perfil</CardTitle></CardHeader><CardContent><ProfileSettingsForm fullName={profile.full_name}/></CardContent></Card>
        <Card><CardHeader><CardTitle>Empresa</CardTitle></CardHeader><CardContent><CompanySettingsForm legalName={company.legal_name} ruc={company.ruc} disabled={!isAdmin}/></CardContent></Card>
      </div>
    </div>
  )
}
