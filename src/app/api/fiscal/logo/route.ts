import { NextResponse } from 'next/server'
import { requireWorkspaceContext } from '@/features/auth/server'
import { fiscalAdminClient } from '@/features/fiscal/server'

export const runtime = 'nodejs'

const BRANDING_BUCKET = 'company-branding'

export async function GET() {
  const context = await requireWorkspaceContext()
  if (context.profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = fiscalAdminClient()
  const { data: settings, error } = await admin
    .from('company_fiscal_settings')
    .select('logo_path,logo_mime')
    .eq('company_id', context.company.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!settings?.logo_path) return NextResponse.json({ error: 'logo_not_found' }, { status: 404 })

  const { data, error: downloadError } = await admin.storage.from(BRANDING_BUCKET).download(settings.logo_path)
  if (downloadError || !data) return NextResponse.json({ error: downloadError?.message ?? 'logo_not_found' }, { status: 404 })

  const bytes = await data.arrayBuffer()
  return new NextResponse(bytes, {
    headers: {
      'content-type': settings.logo_mime || data.type || 'application/octet-stream',
      'cache-control': 'private, no-store',
    },
  })
}
