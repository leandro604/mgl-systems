import { createHash } from 'node:crypto'
import { bankAccountsSchema, digitalWalletsSchema, emailsSchema, normalizeStoredArray, phonesSchema } from '@/features/fiscal/branding'
import { fiscalAdminClient } from '@/features/fiscal/server'
import { downloadDriveFile, ensureDriveFolder, uploadDriveBytes } from '@/features/drive/drive.service'
import { generateInvoicePdf, normalizeInvoicePdfFormat, type InvoicePdfFormat, type PrintableInvoice } from './pdf'

const INTIFACT_BASE = 'https://api-facturacion.intifact.com'
const BRANDING_BUCKET = 'company-branding'
const MONTHS = ['01 - Enero', '02 - Febrero', '03 - Marzo', '04 - Abril', '05 - Mayo', '06 - Junio', '07 - Julio', '08 - Agosto', '09 - Septiembre', '10 - Octubre', '11 - Noviembre', '12 - Diciembre']

type Admin = ReturnType<typeof fiscalAdminClient>
function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

function documentBase(series: string | null, number: number | null, id: string) {
  return series && number !== null ? `${series}-${String(number).padStart(8, '0')}` : id
}

function decodeBase64(value: string) {
  return Uint8Array.from(Buffer.from(value, 'base64'))
}

async function fetchIntifactAsset(documentId: string, asset: 'xml' | 'cdr') {
  const apiKey = process.env.INTIFACT_API_KEY
  if (!apiKey) throw new Error('INTIFACT_API_KEY no está configurada para recuperar el archivo fiscal.')
  const response = await fetch(`${INTIFACT_BASE}/api/v1/invoice/${encodeURIComponent(documentId)}/${asset}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error((await response.text().catch(() => '')) || `Intifact ${asset.toUpperCase()} HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function buildPrintable(admin: Admin, companyId: string, companyName: string, companyRuc: string, invoice: {
  id: string
  project_id: string
  document_type: string
  series: string | null
  number: number | null
  issued_on: string
  currency: string
  customer_name: string
  customer_document_type: string
  customer_document_number: string
  customer_address: string
  status: string
  provider_status: string | null
  cdr_code: string | null
  intifact_document_id: string | null
  emission_provider: string | null
  sunat_digest: string | null
}) {
  const [itemsResult, totalResult, projectResult, fiscalResult] = await Promise.all([
    admin.from('invoice_items').select('line_number,description,unit_code,quantity,unit_price,net_amount,tax_amount').eq('invoice_id', invoice.id).is('deleted_at', null).order('line_number'),
    admin.from('invoice_totals').select('net_amount,tax_amount,total_amount').eq('id', invoice.id).maybeSingle(),
    admin.from('projects').select('name').eq('id', invoice.project_id).maybeSingle(),
    admin.from('company_fiscal_settings').select('trade_name,issuer_address,contact_phones,contact_emails,logo_path,logo_mime,pdf_thank_you_message,pdf_additional_message,bank_accounts,digital_wallets').eq('company_id', companyId).maybeSingle(),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (totalResult.error) throw totalResult.error
  if (projectResult.error) throw projectResult.error
  if (fiscalResult.error) throw fiscalResult.error

  const fiscal = fiscalResult.data
  let logoBytes: Uint8Array | null = null
  let logoMime: string | null = null
  if (fiscal?.logo_path) {
    const { data: logo } = await admin.storage.from(BRANDING_BUCKET).download(fiscal.logo_path)
    if (logo) {
      logoBytes = new Uint8Array(await logo.arrayBuffer())
      logoMime = fiscal.logo_mime || logo.type || null
    }
  }

  const total = totalResult.data
  const printable: PrintableInvoice = {
    id: invoice.id,
    projectId: invoice.project_id,
    projectName: projectResult.data?.name ?? null,
    documentType: invoice.document_type,
    series: invoice.series,
    number: invoice.number,
    issuedOn: invoice.issued_on,
    currency: invoice.currency,
    issuerName: fiscal?.trade_name || companyName,
    issuerRuc: companyRuc,
    issuerAddress: fiscal?.issuer_address || null,
    issuerPhones: normalizeStoredArray(fiscal?.contact_phones, phonesSchema),
    issuerEmails: normalizeStoredArray(fiscal?.contact_emails, emailsSchema),
    issuerLogoBytes: logoBytes,
    issuerLogoMime: logoMime,
    pdfThankYouMessage: fiscal?.pdf_thank_you_message ?? '',
    pdfAdditionalMessage: fiscal?.pdf_additional_message ?? '',
    bankAccounts: normalizeStoredArray(fiscal?.bank_accounts, bankAccountsSchema),
    digitalWallets: normalizeStoredArray(fiscal?.digital_wallets, digitalWalletsSchema),
    customerName: invoice.customer_name,
    customerDocumentType: invoice.customer_document_type,
    customerDocumentNumber: invoice.customer_document_number,
    customerAddress: invoice.customer_address,
    status: invoice.status,
    providerStatus: invoice.provider_status,
    cdrCode: invoice.cdr_code,
    items: (itemsResult.data ?? []).map((item) => ({
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
  return printable
}

async function fiscalBytes(invoice: {
  sunat_xml: string | null
  sunat_cdr_zip_base64: string | null
  intifact_document_id: string | null
}) {
  const xml = invoice.sunat_xml
    ? new TextEncoder().encode(invoice.sunat_xml)
    : invoice.intifact_document_id
      ? await fetchIntifactAsset(invoice.intifact_document_id, 'xml')
      : null
  const cdr = invoice.sunat_cdr_zip_base64
    ? decodeBase64(invoice.sunat_cdr_zip_base64)
    : invoice.intifact_document_id
      ? await fetchIntifactAsset(invoice.intifact_document_id, 'cdr')
      : null
  if (!xml) throw new Error('El XML firmado aún no está disponible para archivarlo en Drive.')
  if (!cdr) throw new Error('El CDR aún no está disponible para archivarlo en Drive.')
  return { xml, cdr }
}

export async function syncInvoiceToFiscalDrive(input: {
  companyId: string
  companyName: string
  companyRuc: string
  projectIds: string[]
  invoiceId: string
}) {
  const admin = fiscalAdminClient()
  const [invoiceResult, settingsResult] = await Promise.all([
    admin.from('invoices').select('*').eq('id', input.invoiceId).eq('company_id', input.companyId).is('deleted_at', null).maybeSingle(),
    admin.from('company_fiscal_settings').select('drive_enabled,drive_provider,drive_cloud_account_id,drive_root_folder_id,invoice_pdf_format,receipt_pdf_format').eq('company_id', input.companyId).maybeSingle(),
  ])
  if (invoiceResult.error) throw invoiceResult.error
  if (settingsResult.error) throw settingsResult.error
  const invoice = invoiceResult.data
  const settings = settingsResult.data
  if (!invoice || !input.projectIds.includes(invoice.project_id)) throw new Error('Comprobante no encontrado.')
  if (invoice.status !== 'accepted') throw new Error('El comprobante todavía no está aceptado por SUNAT.')
  if (!settings?.drive_enabled || !settings.drive_cloud_account_id) throw new Error('El archivo fiscal en Google Drive no está activado para esta empresa.')
  if (settings.drive_provider !== 'google') throw new Error('El archivo fiscal de esta versión requiere Google Drive.')

  const access = { admin: true as const, cloudAccountId: settings.drive_cloud_account_id }
  const format: InvoicePdfFormat = normalizeInvoicePdfFormat(invoice.document_type === '03' ? settings.receipt_pdf_format : settings.invoice_pdf_format, invoice.document_type === '03' ? 'ticket80' : 'a4')

  try {
    const issued = new Date(`${invoice.issued_on}T12:00:00`)
    const year = Number.isFinite(issued.getTime()) ? String(issued.getFullYear()) : invoice.issued_on.slice(0, 4)
    const monthIndex = Number.isFinite(issued.getTime()) ? issued.getMonth() : Math.max(0, Number(invoice.issued_on.slice(5, 7)) - 1)
    const month = MONTHS[monthIndex] ?? `${String(monthIndex + 1).padStart(2, '0')} - Mes`
    const typeFolder = invoice.document_type === '03' ? 'Boletas' : invoice.document_type === '01' ? 'Facturas' : 'Otros comprobantes'

    const mglFolder = await ensureDriveFolder('google', 'MGL Systems', settings.drive_root_folder_id || 'root', access)
    const fiscalFolder = await ensureDriveFolder('google', 'Facturación Electrónica', mglFolder.id, access)
    const yearFolder = await ensureDriveFolder('google', year, fiscalFolder.id, access)
    const documentFolder = await ensureDriveFolder('google', typeFolder, yearFolder.id, access)
    const monthFolder = await ensureDriveFolder('google', month, documentFolder.id, access)

    const printable = await buildPrintable(admin, input.companyId, input.companyName, input.companyRuc, invoice)
    const [{ xml, cdr }, pdf] = await Promise.all([
      fiscalBytes(invoice),
      generateInvoicePdf(printable, false, format),
    ])

    const base = documentBase(invoice.series, invoice.number, invoice.id)
    const fiscalBase = `${input.companyRuc}-${invoice.document_type}-${base}`
    const uploaded = await Promise.all([
      uploadDriveBytes('google', { parentId: monthFolder.id, fileName: `${base}.pdf`, mimeType: 'application/pdf', bytes: pdf }, access),
      uploadDriveBytes('google', { parentId: monthFolder.id, fileName: `${fiscalBase}.xml`, mimeType: 'application/xml', bytes: xml }, access),
      uploadDriveBytes('google', { parentId: monthFolder.id, fileName: `R-${fiscalBase}.zip`, mimeType: 'application/zip', bytes: cdr }, access),
    ])

    const now = new Date().toISOString()
    await admin.from('invoice_cloud_assets').update({
      deleted_at: now,
      updated_at: now,
      server_updated_at: now,
      mutation_id: crypto.randomUUID(),
    }).eq('company_id', input.companyId).eq('invoice_id', invoice.id).eq('asset_type', 'pdf').neq('pdf_format', format).is('deleted_at', null)

    const rows = [
      { assetType: 'pdf', pdfFormat: format, mimeType: 'application/pdf', bytes: pdf, item: uploaded[0] },
      { assetType: 'xml', pdfFormat: '', mimeType: 'application/xml', bytes: xml, item: uploaded[1] },
      { assetType: 'cdr', pdfFormat: '', mimeType: 'application/zip', bytes: cdr, item: uploaded[2] },
    ] as const

    for (const row of rows) {
      const { error } = await admin.from('invoice_cloud_assets').upsert({
        company_id: input.companyId,
        project_id: invoice.project_id,
        invoice_id: invoice.id,
        provider: 'google',
        cloud_account_id: settings.drive_cloud_account_id,
        asset_type: row.assetType,
        pdf_format: row.pdfFormat,
        file_id: row.item.id,
        file_name: row.item.name,
        web_url: row.item.webUrl,
        parent_folder_id: monthFolder.id,
        mime_type: row.mimeType,
        size_bytes: row.bytes.byteLength,
        checksum_sha256: sha256(row.bytes),
        synced_at: now,
        updated_at: now,
        server_updated_at: now,
        mutation_id: crypto.randomUUID(),
        deleted_at: null,
      }, { onConflict: 'company_id,invoice_id,asset_type,pdf_format' })
      if (error) throw error
    }

    const { error: invoicePatchError } = await admin.from('invoices').update({
      pdf_url: uploaded[0].webUrl || `https://drive.google.com/open?id=${encodeURIComponent(uploaded[0].id)}`,
      cdr_url: uploaded[2].webUrl || `https://drive.google.com/open?id=${encodeURIComponent(uploaded[2].id)}`,
      sunat_xml: null,
      sunat_cdr_zip_base64: null,
      cdr_xml: null,
      updated_at: now,
      server_updated_at: now,
      mutation_id: crypto.randomUUID(),
    }).eq('id', invoice.id).eq('company_id', input.companyId)
    if (invoicePatchError) throw invoicePatchError

    await admin.from('company_fiscal_settings').update({
      drive_last_sync_at: now,
      drive_last_sync_error: null,
      updated_at: now,
      server_updated_at: now,
      mutation_id: crypto.randomUUID(),
    }).eq('company_id', input.companyId)

    return {
      ok: true as const,
      format,
      folderId: monthFolder.id,
      folderUrl: monthFolder.webUrl,
      files: rows.map((row) => ({ type: row.assetType, id: row.item.id, name: row.item.name, webUrl: row.item.webUrl })),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar el comprobante con Google Drive.'
    try {
      const failedAt = new Date().toISOString()
      await admin.from('company_fiscal_settings').update({
        drive_last_sync_error: message,
        updated_at: failedAt,
        server_updated_at: failedAt,
        mutation_id: crypto.randomUUID(),
      }).eq('company_id', input.companyId)
    } catch {
      // El error original de Drive tiene prioridad; este registro es sólo diagnóstico.
    }
    throw error
  }
}

export async function getInvoiceDriveAsset(input: {
  companyId: string
  invoiceId: string
  assetType: 'pdf' | 'xml' | 'cdr'
  pdfFormat?: InvoicePdfFormat
}) {
  const admin = fiscalAdminClient()
  let query = admin.from('invoice_cloud_assets')
    .select('provider,cloud_account_id,file_id,file_name,mime_type,pdf_format')
    .eq('company_id', input.companyId)
    .eq('invoice_id', input.invoiceId)
    .eq('asset_type', input.assetType)
    .is('deleted_at', null)
  if (input.assetType === 'pdf' && input.pdfFormat) query = query.eq('pdf_format', input.pdfFormat)
  const { data, error } = await query.order('synced_at', { ascending: false }).limit(1).maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    throw error
  }
  if (!data || data.provider !== 'google') return null
  const download = await downloadDriveFile('google', data.file_id, { admin: true, cloudAccountId: data.cloud_account_id })
  return { ...download, fileName: data.file_name, mimeType: data.mime_type, pdfFormat: data.pdf_format }
}
