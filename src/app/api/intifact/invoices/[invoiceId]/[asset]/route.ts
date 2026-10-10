import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canManageFinance } from '@/features/purchases/server'

const INTIFACT_BASE = 'https://api-facturacion.intifact.com'
const ASSETS = new Set(['pdf', 'xml', 'cdr'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string; asset: string }> },
) {
  const { invoiceId, asset } = await params
  if (!ASSETS.has(asset)) return NextResponse.json({ error: 'unsupported_asset' }, { status: 404 })

  const context = await requireWorkspaceContext()
  if (!canManageFinance(context.profile.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id,intifact_document_id,series,number')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!invoice?.intifact_document_id) return NextResponse.json({ error: 'intifact_document_unavailable' }, { status: 404 })

  const apiKey = process.env.INTIFACT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'intifact_not_configured' }, { status: 503 })

  const suffix = asset === 'pdf' ? 'pdf?format=a4' : asset
  const upstream = await fetch(
    `${INTIFACT_BASE}/api/v1/invoice/${encodeURIComponent(invoice.intifact_document_id)}/${suffix}`,
    { headers: { authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return NextResponse.json({ error: 'intifact_asset_failed', detail }, { status: upstream.status })
  }

  const bytes = await upstream.arrayBuffer()
  const contentType = upstream.headers.get('content-type') ?? (asset === 'pdf' ? 'application/pdf' : 'application/octet-stream')
  const number = invoice.series && invoice.number !== null
    ? `${invoice.series}-${String(invoice.number).padStart(8, '0')}`
    : invoice.id
  const extension = asset === 'cdr' ? 'zip' : asset

  return new NextResponse(bytes, {
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${number}.${extension}"`,
      'cache-control': 'private, no-store',
    },
  })
}
