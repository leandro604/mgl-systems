import { NextResponse } from 'next/server'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canManageFinance } from '@/features/purchases/server'
import { syncInvoiceToFiscalDrive } from '@/features/invoices/drive-storage'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params
  const context = await requireWorkspaceContext()
  if (!canManageFinance(context.profile.role)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  try {
    const result = await syncInvoiceToFiscalDrive({
      companyId: context.company.id,
      companyName: context.company.legal_name,
      companyRuc: context.company.ruc,
      projectIds: context.projects.map((project) => project.id),
      invoiceId,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo sincronizar con Google Drive.' }, { status: 409 })
  }
}
