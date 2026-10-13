import { notFound } from 'next/navigation'
import { fiscalAdminClient } from '@/features/fiscal/server'
import { requireWorkspaceContext } from '@/features/auth/server'
import { requireProjectContext } from '@/features/projects/server'
import { canManageFinance } from '@/features/purchases/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeInvoicePdfFormat } from './pdf'

export async function getInvoicesOverview() {
  const supabase = await createClient()
  const [context, financeResults] = await Promise.all([
    requireWorkspaceContext(),
    Promise.all([
      supabase
        .from('invoices')
        .select('id,project_id,document_type,series,number,issued_on,currency,customer_document_type,customer_document_number,customer_name,status,cdr_code,cdr_url,accepted_at,last_error,created_at,intifact_idempotency_hash,intifact_document_id,cdr_xml,pdf_url,provider_status,customer_address,emission_provider,sunat_response_description,sunat_digest')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('invoice_totals').select('id,total_amount'),
      supabase
        .from('fiscal_series')
        .select('id,document_type,series,next_number,active,last_issued_at,created_at')
        .is('deleted_at', null)
        .order('series'),
      supabase.from('project_financial_summary').select('*'),
    ]),
  ])
  if (!canManageFinance(context.profile.role)) {
    return { ...context, allowed: false as const, invoices: [], totals: new Map<string, number>(), series: [], summaries: [] }
  }

  const [invoicesResult, totalsResult, seriesResult, summaryResult] = financeResults
  if (invoicesResult.error) throw invoicesResult.error
  if (totalsResult.error) throw totalsResult.error
  if (seriesResult.error) throw seriesResult.error
  if (summaryResult.error) throw summaryResult.error

  return {
    ...context,
    allowed: true as const,
    invoices: invoicesResult.data ?? [],
    totals: new Map((totalsResult.data ?? []).flatMap((row) => row.id ? [[row.id, Number(row.total_amount ?? 0)] as const] : [])),
    series: seriesResult.data ?? [],
    summaries: summaryResult.data ?? [],
  }
}

export async function getProjectInvoices(projectId: string) {
  const supabase = await createClient()
  const [context, financeResults] = await Promise.all([
    requireProjectContext(projectId),
    Promise.all([
      supabase
        .from('invoices')
        .select('id,project_id,document_type,series,number,issued_on,currency,customer_document_type,customer_document_number,customer_name,status,cdr_code,cdr_url,accepted_at,last_error,created_at,intifact_idempotency_hash,intifact_document_id,cdr_xml,pdf_url,provider_status,customer_address,emission_provider,sunat_response_description,sunat_digest')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('invoice_totals').select('id,total_amount').eq('project_id', projectId),
      supabase
        .from('fiscal_series')
        .select('id,document_type,series,next_number,active,last_issued_at')
        .is('deleted_at', null)
        .eq('active', true)
        .order('series'),
      supabase.from('project_financial_summary').select('*').eq('project_id', projectId).maybeSingle(),
    ]),
  ])
  if (!canManageFinance(context.profile.role)) {
    return { ...context, allowed: false as const, invoices: [], totals: new Map<string, number>(), series: [], summary: null }
  }

  const [invoicesResult, totalsResult, seriesResult, summaryResult] = financeResults
  if (invoicesResult.error) throw invoicesResult.error
  if (totalsResult.error) throw totalsResult.error
  if (seriesResult.error) throw seriesResult.error
  if (summaryResult.error) throw summaryResult.error

  return {
    ...context,
    allowed: true as const,
    invoices: invoicesResult.data ?? [],
    totals: new Map((totalsResult.data ?? []).flatMap((row) => row.id ? [[row.id, Number(row.total_amount ?? 0)] as const] : [])),
    series: seriesResult.data ?? [],
    summary: summaryResult.data,
  }
}

export async function getInvoiceDetail(projectId: string, invoiceId: string) {
  const context = await getProjectInvoices(projectId)
  if (!context.allowed) return { ...context, invoice: null, items: [], total: null }
  const invoice = context.invoices.find((item) => item.id === invoiceId)
  if (!invoice) notFound()

  const admin = fiscalAdminClient()
  const [itemsResult, totalResult, fiscalResult, assetsResult] = await Promise.all([
    context.supabase
      .from('invoice_items')
      .select('id,line_number,description,unit_code,quantity,unit_price,tax_rate,net_amount,tax_amount,deleted_at')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('line_number'),
    context.supabase.from('invoice_totals').select('*').eq('id', invoiceId).maybeSingle(),
    admin.from('company_fiscal_settings')
      .select('drive_enabled,drive_last_sync_error,invoice_pdf_format,receipt_pdf_format')
      .eq('company_id', context.company.id)
      .maybeSingle(),
    admin.from('invoice_cloud_assets')
      .select('asset_type,pdf_format,file_id,web_url,parent_folder_id,synced_at')
      .eq('company_id', context.company.id)
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (totalResult.error) throw totalResult.error

  const assets = assetsResult.error ? [] : (assetsResult.data ?? [])
  const assetTypes = new Set(assets.map((asset) => asset.asset_type))
  const defaultPdfFormat = invoice.document_type === '03'
    ? normalizeInvoicePdfFormat(fiscalResult.data?.receipt_pdf_format, 'ticket80')
    : normalizeInvoicePdfFormat(fiscalResult.data?.invoice_pdf_format, 'a4')
  const hasDefaultPdf = assets.some((asset) => asset.asset_type === 'pdf' && asset.pdf_format === defaultPdfFormat)
  const driveSynced = hasDefaultPdf && assetTypes.has('xml') && assetTypes.has('cdr')
  const folderId = assets.find((asset) => asset.parent_folder_id)?.parent_folder_id ?? null

  return {
    ...context,
    invoice,
    items: itemsResult.data ?? [],
    total: totalResult.data,
    fiscalPresentation: {
      defaultPdfFormat,
      driveEnabled: fiscalResult.error ? false : Boolean(fiscalResult.data?.drive_enabled),
      driveSynced,
      driveLastSyncError: fiscalResult.error ? null : fiscalResult.data?.drive_last_sync_error ?? null,
      driveFolderUrl: folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null,
    },
  }
}
