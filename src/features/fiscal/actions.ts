'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FormActionState } from '@/features/auth/types'
import { requireWorkspaceContext } from '@/features/auth/server'
import { encryptFiscalSecret } from './crypto'
import { fiscalAdminClient } from './server'
import {
  bankAccountsSchema,
  digitalWalletsSchema,
  emailsSchema,
  parseJsonArray,
  phonesSchema,
} from './branding'

const BRANDING_BUCKET = 'company-branding'
const LOGO_MAX_BYTES = 2 * 1024 * 1024

const schema = z.object({
  provider: z.enum(['intifact', 'sunat_direct']),
  environment: z.enum(['beta', 'production']),
  trade_name: z.string().trim().max(250),
  issuer_address: z.string().trim().max(500),
  ubigeo: z.string().trim().regex(/^$|^[0-9]{6}$/, 'El ubigeo debe tener 6 dígitos.'),
  department: z.string().trim().max(120),
  province: z.string().trim().max(120),
  district: z.string().trim().max(120),
  establishment_code: z.string().trim().toUpperCase().regex(/^[0-9A-Z]{4}$/, 'El código de establecimiento debe tener 4 caracteres.'),
  pdf_thank_you_message: z.string().trim().max(300, 'El mensaje de agradecimiento no debe superar 300 caracteres.'),
  pdf_additional_message: z.string().trim().max(500, 'El mensaje adicional no debe superar 500 caracteres.'),
  invoice_pdf_format: z.enum(['a4', 'a5', 'ticket80', 'ticket58']),
  receipt_pdf_format: z.enum(['a4', 'a5', 'ticket80', 'ticket58']),
})

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function detectLogoMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

async function ensureBrandingBucket() {
  const admin = fiscalAdminClient()
  const { data } = await admin.storage.getBucket(BRANDING_BUCKET)
  if (data) return
  const { error } = await admin.storage.createBucket(BRANDING_BUCKET, {
    public: false,
    allowedMimeTypes: ['image/png', 'image/jpeg'],
    fileSizeLimit: LOGO_MAX_BYTES,
  })
  if (error && !/already exists/i.test(error.message)) throw error
}

export async function saveFiscalSettingsAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = schema.safeParse({
    provider: formData.get('provider'),
    environment: formData.get('environment'),
    trade_name: formData.get('trade_name') ?? '',
    issuer_address: formData.get('issuer_address') ?? '',
    ubigeo: formData.get('ubigeo') ?? '',
    department: formData.get('department') ?? '',
    province: formData.get('province') ?? '',
    district: formData.get('district') ?? '',
    establishment_code: formData.get('establishment_code') ?? '0000',
    pdf_thank_you_message: formData.get('pdf_thank_you_message') ?? '',
    pdf_additional_message: formData.get('pdf_additional_message') ?? '',
    invoice_pdf_format: formData.get('invoice_pdf_format') ?? 'a4',
    receipt_pdf_format: formData.get('receipt_pdf_format') ?? 'ticket80',
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la configuración fiscal.' }

  try {
    const context = await requireWorkspaceContext()
    if (context.profile.role !== 'admin') return { status: 'error', message: 'Solo un administrador puede configurar la emisión electrónica.' }

    const contactPhones = parseJsonArray(formData.get('contact_phones_json'), phonesSchema)
    const contactEmails = parseJsonArray(formData.get('contact_emails_json'), emailsSchema)
    const bankAccounts = parseJsonArray(formData.get('bank_accounts_json'), bankAccountsSchema)
    const digitalWallets = parseJsonArray(formData.get('digital_wallets_json'), digitalWalletsSchema)

    const admin = fiscalAdminClient()
    const { data: current, error: currentError } = await admin.from('company_fiscal_settings').select('*').eq('company_id', context.company.id).maybeSingle()
    if (currentError && currentError.code !== 'PGRST116') return { status: 'error', message: currentError.message }

    const driveEnabled = formData.get('drive_enabled') === 'on'
    let driveCloudAccountId: string | null = null
    if (driveEnabled) {
      const { data: googleDrive, error: driveError } = await context.supabase
        .from('cloud_accounts')
        .select('id')
        .eq('user_id', context.userId)
        .eq('provider', 'google')
        .is('deleted_at', null)
        .maybeSingle()
      if (driveError) return { status: 'error', message: driveError.message }
      if (googleDrive) {
        driveCloudAccountId = googleDrive.id
      } else if (current?.drive_cloud_account_id) {
        const { data: preservedDrive, error: preservedDriveError } = await admin
          .from('cloud_accounts')
          .select('id')
          .eq('id', current.drive_cloud_account_id)
          .eq('company_id', context.company.id)
          .eq('provider', 'google')
          .is('deleted_at', null)
          .maybeSingle()
        if (preservedDriveError) return { status: 'error', message: preservedDriveError.message }
        if (preservedDrive) driveCloudAccountId = preservedDrive.id
      }
      if (!driveCloudAccountId) return { status: 'error', message: 'Conecta Google Drive en Configuración → Integraciones antes de activar el archivo fiscal.' }
    }

    const solUser = optionalText(formData, 'sol_user')
    const solPassword = optionalText(formData, 'sol_password')
    const certificatePassword = optionalText(formData, 'certificate_password')
    const certificate = formData.get('certificate')
    const logo = formData.get('company_logo')
    const removeLogo = formData.get('remove_logo') === 'on'

    let certificatePfxEnc = current?.certificate_pfx_enc ?? null
    let certificateName = current?.certificate_name ?? null
    let certificateUploadedAt = current?.certificate_uploaded_at ?? null
    if (certificate instanceof File && certificate.size > 0) {
      if (certificate.size > 2_500_000) return { status: 'error', message: 'El certificado PFX/P12 no debe superar 2.5 MB.' }
      const lower = certificate.name.toLowerCase()
      if (!lower.endsWith('.pfx') && !lower.endsWith('.p12')) return { status: 'error', message: 'Carga un certificado .pfx o .p12.' }
      const base64 = Buffer.from(await certificate.arrayBuffer()).toString('base64')
      certificatePfxEnc = encryptFiscalSecret(base64)
      certificateName = certificate.name
      certificateUploadedAt = new Date().toISOString()
    }

    let logoPath = current?.logo_path ?? null
    let logoName = current?.logo_name ?? null
    let logoMime = current?.logo_mime ?? null
    let logoUploadedAt = current?.logo_uploaded_at ?? null

    if (logo instanceof File && logo.size > 0) {
      if (logo.size > LOGO_MAX_BYTES) return { status: 'error', message: 'El logo no debe superar 2 MB.' }
      const buffer = await logo.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const detectedMime = detectLogoMime(bytes)
      if (!detectedMime) return { status: 'error', message: 'El logo debe ser una imagen PNG o JPG válida.' }

      await ensureBrandingBucket()
      const extension = detectedMime === 'image/png' ? 'png' : 'jpg'
      const nextPath = `${context.company.id}/invoice-logo.${extension}`
      const { error: uploadError } = await admin.storage.from(BRANDING_BUCKET).upload(nextPath, buffer, {
        contentType: detectedMime,
        cacheControl: '3600',
        upsert: true,
      })
      if (uploadError) return { status: 'error', message: `No se pudo guardar el logo: ${uploadError.message}` }
      if (logoPath && logoPath !== nextPath) await admin.storage.from(BRANDING_BUCKET).remove([logoPath]).catch(() => undefined)
      logoPath = nextPath
      logoName = logo.name
      logoMime = detectedMime
      logoUploadedAt = new Date().toISOString()
    } else if (removeLogo && logoPath) {
      await admin.storage.from(BRANDING_BUCKET).remove([logoPath]).catch(() => undefined)
      logoPath = null
      logoName = null
      logoMime = null
      logoUploadedAt = null
    }

    const row = {
      company_id: context.company.id,
      provider: parsed.data.provider,
      environment: parsed.data.environment,
      trade_name: parsed.data.trade_name,
      issuer_address: parsed.data.issuer_address,
      ubigeo: parsed.data.ubigeo,
      department: parsed.data.department,
      province: parsed.data.province,
      district: parsed.data.district,
      establishment_code: parsed.data.establishment_code,
      sol_user_enc: solUser ? encryptFiscalSecret(solUser) : current?.sol_user_enc ?? null,
      sol_password_enc: solPassword ? encryptFiscalSecret(solPassword) : current?.sol_password_enc ?? null,
      certificate_pfx_enc: certificatePfxEnc,
      certificate_password_enc: certificatePassword ? encryptFiscalSecret(certificatePassword) : current?.certificate_password_enc ?? null,
      certificate_name: certificateName,
      certificate_uploaded_at: certificateUploadedAt,
      contact_phones: contactPhones,
      contact_emails: contactEmails,
      logo_path: logoPath,
      logo_name: logoName,
      logo_mime: logoMime,
      logo_uploaded_at: logoUploadedAt,
      pdf_thank_you_message: parsed.data.pdf_thank_you_message,
      pdf_additional_message: parsed.data.pdf_additional_message,
      bank_accounts: bankAccounts,
      digital_wallets: digitalWallets,
      drive_enabled: driveEnabled,
      drive_provider: 'google',
      drive_cloud_account_id: driveCloudAccountId,
      drive_root_folder_id: current?.drive_root_folder_id ?? 'root',
      invoice_pdf_format: parsed.data.invoice_pdf_format,
      receipt_pdf_format: parsed.data.receipt_pdf_format,
      drive_last_sync_error: driveEnabled ? current?.drive_last_sync_error ?? null : null,
      configured_by: context.userId,
      updated_at: new Date().toISOString(),
      mutation_id: crypto.randomUUID(),
    }
    const { error } = await admin.from('company_fiscal_settings').upsert(row, { onConflict: 'company_id' })
    if (error) return { status: 'error', message: error.message }
    revalidatePath('/app/configuracion/facturacion')
    revalidatePath('/app/invoices')
    return { status: 'success', message: 'Configuración fiscal, formatos PDF y almacenamiento en Drive guardados correctamente.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo guardar la configuración fiscal.' }
  }
}
