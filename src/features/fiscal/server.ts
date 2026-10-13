import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireWorkspaceContext } from '@/features/auth/server'
import type { Database } from '@/lib/supabase/database.types'
import {
  bankAccountsSchema,
  digitalWalletsSchema,
  emailsSchema,
  normalizeStoredArray,
  phonesSchema,
} from './branding'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o una clave privada de Supabase (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY).')
  return createAdminClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function getFiscalSettingsSummary() {
  const context = await requireWorkspaceContext()
  if (context.profile.role !== 'admin') return { ...context, allowed: false as const, settings: null, series: [], googleDrive: null }
  const [settingsResult, seriesResult, googleDriveResult] = await Promise.all([
    admin()
      .from('company_fiscal_settings')
      .select('company_id,provider,environment,trade_name,issuer_address,ubigeo,department,province,district,establishment_code,sol_user_enc,sol_password_enc,certificate_pfx_enc,certificate_password_enc,certificate_name,certificate_uploaded_at,contact_phones,contact_emails,logo_path,logo_name,logo_mime,logo_uploaded_at,pdf_thank_you_message,pdf_additional_message,bank_accounts,digital_wallets,drive_enabled,drive_provider,drive_cloud_account_id,drive_root_folder_id,invoice_pdf_format,receipt_pdf_format,drive_last_sync_at,drive_last_sync_error,updated_at')
      .eq('company_id', context.company.id)
      .maybeSingle(),
    context.supabase
      .from('fiscal_series')
      .select('id,document_type,series,next_number,active,last_issued_at,created_at')
      .is('deleted_at', null)
      .order('document_type')
      .order('series'),
    context.supabase
      .from('cloud_accounts')
      .select('id,account_email,account_name')
      .eq('user_id', context.userId)
      .eq('provider', 'google')
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  if (seriesResult.error) throw seriesResult.error
  if (googleDriveResult.error && googleDriveResult.error.code !== 'PGRST116') throw googleDriveResult.error
  const { data, error } = settingsResult
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') {
      return { ...context, allowed: true as const, schemaPending: true as const, settings: null, series: seriesResult.data ?? [], googleDrive: googleDriveResult.data ? { id: googleDriveResult.data.id, email: googleDriveResult.data.account_email ?? googleDriveResult.data.account_name ?? null } : null }
    }
    throw error
  }
  return {
    ...context,
    allowed: true as const,
    schemaPending: false as const,
    series: seriesResult.data ?? [],
    googleDrive: googleDriveResult.data ? { id: googleDriveResult.data.id, email: googleDriveResult.data.account_email ?? googleDriveResult.data.account_name ?? null } : null,
    settings: data ? {
      provider: data.provider,
      environment: data.environment,
      tradeName: data.trade_name,
      issuerAddress: data.issuer_address,
      ubigeo: data.ubigeo,
      department: data.department,
      province: data.province,
      district: data.district,
      establishmentCode: data.establishment_code,
      hasSolUser: Boolean(data.sol_user_enc),
      hasSolPassword: Boolean(data.sol_password_enc),
      hasCertificate: Boolean(data.certificate_pfx_enc),
      hasCertificatePassword: Boolean(data.certificate_password_enc),
      certificateName: data.certificate_name,
      certificateUploadedAt: data.certificate_uploaded_at,
      contactPhones: normalizeStoredArray(data.contact_phones, phonesSchema),
      contactEmails: normalizeStoredArray(data.contact_emails, emailsSchema),
      hasLogo: Boolean(data.logo_path),
      logoName: data.logo_name,
      logoMime: data.logo_mime,
      logoUploadedAt: data.logo_uploaded_at,
      pdfThankYouMessage: data.pdf_thank_you_message,
      pdfAdditionalMessage: data.pdf_additional_message,
      bankAccounts: normalizeStoredArray(data.bank_accounts, bankAccountsSchema),
      digitalWallets: normalizeStoredArray(data.digital_wallets, digitalWalletsSchema),
      driveEnabled: data.drive_enabled,
      driveProvider: data.drive_provider,
      driveCloudAccountId: data.drive_cloud_account_id,
      driveRootFolderId: data.drive_root_folder_id,
      invoicePdfFormat: data.invoice_pdf_format,
      receiptPdfFormat: data.receipt_pdf_format,
      driveLastSyncAt: data.drive_last_sync_at,
      driveLastSyncError: data.drive_last_sync_error,
      hasGoogleDrive: Boolean(data.drive_cloud_account_id || googleDriveResult.data?.id),
      googleDriveEmail: googleDriveResult.data?.account_email ?? googleDriveResult.data?.account_name ?? null,
      updatedAt: data.updated_at,
    } : null,
  }
}

export function fiscalAdminClient() {
  return admin()
}
