import { NextRequest, NextResponse } from 'next/server'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canManageFinance } from '@/features/purchases/server'
import { generateInvoicePdf, normalizeInvoicePdfFormat, type InvoicePdfFormat, type PrintableInvoice } from '@/features/invoices/pdf'
import { getInvoiceDriveAsset } from '@/features/invoices/drive-storage'
import { fiscalAdminClient } from '@/features/fiscal/server'
import { bankAccountsSchema, digitalWalletsSchema, emailsSchema, normalizeStoredArray, phonesSchema } from '@/features/fiscal/branding'

export const runtime = 'nodejs'

const INTIFACT_BASE = 'https://api-facturacion.intifact.com'
const ASSETS = new Set(['pdf', 'xml', 'cdr'])
const BRANDING_BUCKET = 'company-branding'

function fileBase(series: string | null, number: number | null, id: string) {
  return series && number !== null ? `${series}-${String(number).padStart(8, '0')}` : id
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'))
}

async function intifactAsset(documentId: string, asset: string) {
  const apiKey = process.env.INTIFACT_API_KEY
  if (!apiKey) return { response: null, error: 'intifact_not_configured', status: 503 }
  const suffix = asset === 'pdf' ? 'pdf?format=a4' : asset
  const response = await fetch(`${INTIFACT_BASE}/api/v1/invoice/${encodeURIComponent(documentId)}/${suffix}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!response.ok) {
    return { response: null, error: await response.text().catch(() => `Intifact HTTP ${response.status}`), status: response.status }
  }
  return { response, error: null, status: response.status }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string; asset: string }> },
) {
  const { invoiceId, asset } = await params
  if (!ASSETS.has(asset)) return NextResponse.json({ error: 'unsupported_asset' }, { status: 404 })

  const context = await requireWorkspaceContext()
  if (!canManageFinance(context.profile.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: invoice, error: invoiceError } = await context.supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('company_id', context.company.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 400 })
  if (!invoice || !context.projects.some((project) => project.id === invoice.project_id)) {
    return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 })
  }

  const name = fileBase(invoice.series, invoice.number, invoice.id)
  let driveError: string | null = null
  let pdfFormat: InvoicePdfFormat = invoice.document_type === '03' ? 'ticket80' : 'a4'
  if (asset === 'pdf') {
    try {
      const { data: formatSettings } = await fiscalAdminClient()
        .from('company_fiscal_settings')
        .select('invoice_pdf_format,receipt_pdf_format')
        .eq('company_id', context.company.id)
        .maybeSingle()
      const configured = invoice.document_type === '03' ? formatSettings?.receipt_pdf_format : formatSettings?.invoice_pdf_format
      pdfFormat = normalizeInvoicePdfFormat(request.nextUrl.searchParams.get('format'), normalizeInvoicePdfFormat(configured, pdfFormat))
      const archived = await getInvoiceDriveAsset({ companyId: context.company.id, invoiceId: invoice.id, assetType: 'pdf', pdfFormat })
      if (archived) {
        return new NextResponse(Uint8Array.from(archived.bytes).buffer, {
          headers: {
            'content-type': archived.contentType || archived.mimeType || 'application/pdf',
            'content-disposition': `attachment; filename="${archived.fileName}"`,
            'cache-control': 'private, no-store',
          },
        })
      }
    } catch (error) {
      driveError = error instanceof Error ? error.message : 'No se pudo leer el PDF desde Google Drive.'
    }
  } else {
    try {
      const archived = await getInvoiceDriveAsset({ companyId: context.company.id, invoiceId: invoice.id, assetType: asset as 'xml' | 'cdr' })
      if (archived) {
        return new NextResponse(Uint8Array.from(archived.bytes).buffer, {
          headers: {
            'content-type': archived.contentType || archived.mimeType,
            'content-disposition': `attachment; filename="${archived.fileName}"`,
            'cache-control': 'private, no-store',
          },
        })
      }
    } catch (error) {
      driveError = error instanceof Error ? error.message : 'No se pudo leer el archivo desde Google Drive.'
    }
  }

  if (asset === 'pdf') {
    const [{ data: items, error: itemsError }, { data: total, error: totalError }] = await Promise.all([
      context.supabase
        .from('invoice_items')
        .select('line_number,description,unit_code,quantity,unit_price,net_amount,tax_amount')
        .eq('invoice_id', invoice.id)
        .is('deleted_at', null)
        .order('line_number'),
      context.supabase.from('invoice_totals').select('net_amount,tax_amount,total_amount').eq('id', invoice.id).maybeSingle(),
    ])
    if (itemsError || totalError) return NextResponse.json({ error: itemsError?.message ?? totalError?.message }, { status: 400 })
    const project = context.projects.find((row) => row.id === invoice.project_id)
    let issuerAddress: string | null = null
    let issuerName = context.company.legal_name
    let issuerPhones: string[] = []
    let issuerEmails: string[] = []
    let issuerLogoBytes: Uint8Array | null = null
    let issuerLogoMime: string | null = null
    let pdfThankYouMessage = ''
    let pdfAdditionalMessage = ''
    let bankAccounts: PrintableInvoice['bankAccounts'] = []
    let digitalWallets: PrintableInvoice['digitalWallets'] = []
    try {
      const admin = fiscalAdminClient()
      const { data: fiscal } = await admin
        .from('company_fiscal_settings')
        .select('trade_name,issuer_address,contact_phones,contact_emails,logo_path,logo_mime,pdf_thank_you_message,pdf_additional_message,bank_accounts,digital_wallets')
        .eq('company_id', context.company.id)
        .maybeSingle()
      issuerAddress = fiscal?.issuer_address || null
      issuerName = fiscal?.trade_name || context.company.legal_name
      issuerPhones = normalizeStoredArray(fiscal?.contact_phones, phonesSchema)
      issuerEmails = normalizeStoredArray(fiscal?.contact_emails, emailsSchema)
      pdfThankYouMessage = fiscal?.pdf_thank_you_message ?? ''
      pdfAdditionalMessage = fiscal?.pdf_additional_message ?? ''
      bankAccounts = normalizeStoredArray(fiscal?.bank_accounts, bankAccountsSchema)
      digitalWallets = normalizeStoredArray(fiscal?.digital_wallets, digitalWalletsSchema)
      if (fiscal?.logo_path) {
        const { data: logo } = await admin.storage.from(BRANDING_BUCKET).download(fiscal.logo_path)
        if (logo) {
          issuerLogoBytes = new Uint8Array(await logo.arrayBuffer())
          issuerLogoMime = fiscal.logo_mime || logo.type || null
        }
      }
    } catch {
      // PDF sigue disponible aunque la migración fiscal o el logo aún no estén disponibles.
    }
    const printable: PrintableInvoice = {
      id: invoice.id,
      projectId: invoice.project_id,
      projectName: project?.name ?? null,
      documentType: invoice.document_type,
      series: invoice.series,
      number: invoice.number,
      issuedOn: invoice.issued_on,
      currency: invoice.currency,
      issuerName,
      issuerRuc: context.company.ruc,
      issuerAddress,
      issuerPhones,
      issuerEmails,
      issuerLogoBytes,
      issuerLogoMime,
      pdfThankYouMessage,
      pdfAdditionalMessage,
      bankAccounts,
      digitalWallets,
      customerName: invoice.customer_name,
      customerDocumentType: invoice.customer_document_type,
      customerDocumentNumber: invoice.customer_document_number,
      customerAddress: invoice.customer_address,
      status: invoice.status,
      providerStatus: invoice.provider_status,
      cdrCode: invoice.cdr_code,
      items: (items ?? []).map((item) => ({
        lineNumber: item.line_number,
        description: item.description,
        unitCode: item.unit_code,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        netAmount: item.net_amount === null ? null : Number(item.net_amount),
        taxAmount: item.tax_amount === null ? null : Number(item.tax_amount),
      })),
      netAmount: Number(total?.net_amount ?? 0),
      taxAmount: Number(total?.tax_amount ?? 0),
      totalAmount: Number(total?.total_amount ?? 0),
      intifactDocumentId: invoice.intifact_document_id,
      emissionProvider: invoice.emission_provider,
      sunatDigest: invoice.sunat_digest,
    }
    const bytes = await generateInvoicePdf(printable, invoice.status !== 'accepted', pdfFormat)
    return new NextResponse(Uint8Array.from(bytes).buffer, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${name}${pdfFormat === 'a4' ? '' : `-${pdfFormat}`}.pdf"`,
        'cache-control': 'private, no-store',
      },
    })
  }

  if (asset === 'xml') {
    const signedXml = 'sunat_xml' in invoice && typeof invoice.sunat_xml === 'string' ? invoice.sunat_xml : null
    if (signedXml) {
      return new NextResponse(signedXml, {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'content-disposition': `attachment; filename="${name}.xml"`,
          'cache-control': 'private, no-store',
        },
      })
    }
  }

  if (asset === 'cdr') {
    const cdrBase64 = 'sunat_cdr_zip_base64' in invoice && typeof invoice.sunat_cdr_zip_base64 === 'string'
      ? invoice.sunat_cdr_zip_base64
      : null
    if (cdrBase64) {
      return new NextResponse(Uint8Array.from(decodeBase64(cdrBase64)).buffer, {
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="R-${name}.zip"`,
          'cache-control': 'private, no-store',
        },
      })
    }
  }

  if (invoice.intifact_document_id) {
    const upstream = await intifactAsset(invoice.intifact_document_id, asset)
    if (!upstream.response) return NextResponse.json({ error: 'intifact_asset_failed', detail: upstream.error }, { status: upstream.status })
    const bytes = await upstream.response.arrayBuffer()
    const contentType = upstream.response.headers.get('content-type') ?? (asset === 'xml' ? 'application/xml' : 'application/zip')
    const extension = asset === 'cdr' ? 'zip' : asset
    return new NextResponse(bytes, {
      headers: {
        'content-type': contentType,
        'content-disposition': `attachment; filename="${asset === 'cdr' ? 'R-' : ''}${name}.${extension}"`,
        'cache-control': 'private, no-store',
      },
    })
  }

  if (driveError) return NextResponse.json({ error: 'drive_asset_unavailable', detail: driveError }, { status: 502 })
  return NextResponse.json({ error: `${asset}_unavailable` }, { status: 404 })
}
