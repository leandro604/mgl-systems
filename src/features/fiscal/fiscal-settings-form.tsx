'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  Building2,
  FileKey2,
  ImageIcon,
  HardDrive,
  Landmark,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { initialFormState } from '@/features/auth/types'
import type { FiscalBankAccount, FiscalDigitalWallet } from './branding'
import { saveFiscalSettingsAction } from './actions'

type Summary = {
  provider: string
  environment: string
  tradeName: string
  issuerAddress: string
  ubigeo: string
  department: string
  province: string
  district: string
  establishmentCode: string
  hasSolUser: boolean
  hasSolPassword: boolean
  hasCertificate: boolean
  hasCertificatePassword: boolean
  certificateName: string | null
  certificateUploadedAt: string | null
  contactPhones: string[]
  contactEmails: string[]
  hasLogo: boolean
  logoName: string | null
  logoMime: string | null
  logoUploadedAt: string | null
  pdfThankYouMessage: string
  pdfAdditionalMessage: string
  bankAccounts: FiscalBankAccount[]
  digitalWallets: FiscalDigitalWallet[]
  driveEnabled: boolean
  driveProvider: string
  driveCloudAccountId: string | null
  driveRootFolderId: string
  invoicePdfFormat: string
  receiptPdfFormat: string
  driveLastSyncAt: string | null
  driveLastSyncError: string | null
  hasGoogleDrive: boolean
  googleDriveEmail: string | null
  updatedAt: string
} | null

const emptyBankAccount = (): FiscalBankAccount => ({ bank: '', accountType: 'Cuenta corriente', currency: 'PEN', accountNumber: '', cci: '', holder: '' })
const emptyWallet = (): FiscalDigitalWallet => ({ provider: 'Yape', phone: '', holder: '' })

function Message({ status, message }: { status: string; message: string }) {
  if (!message) return null
  return <p aria-live="polite" className={`rounded-xl border p-3 text-sm ${status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{message}</p>
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Building2; title: string; description?: string }) {
  return <div className="mb-4 flex items-center gap-2"><Icon className="size-4 text-blue-600" /><p className="text-sm font-medium text-slate-700">{title}</p></div>
}

export function FiscalSettingsForm({ settings, companyRuc, googleDrive }: { settings: Summary; companyRuc: string; googleDrive?: { id: string; email: string | null } | null }) {
  const [state, action] = useActionState(saveFiscalSettingsAction, initialFormState)
  const [phones, setPhones] = useState<string[]>(settings?.contactPhones ?? [])
  const [emails, setEmails] = useState<string[]>(settings?.contactEmails ?? [])
  const [bankAccounts, setBankAccounts] = useState<FiscalBankAccount[]>(settings?.bankAccounts ?? [])
  const [wallets, setWallets] = useState<FiscalDigitalWallet[]>(settings?.digitalWallets ?? [])
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => () => {
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
  }, [logoPreview])

  const hasGoogleDrive = settings?.hasGoogleDrive ?? Boolean(googleDrive?.id)
  const googleDriveEmail = settings?.googleDriveEmail ?? googleDrive?.email ?? null

  const savedLogoUrl = settings?.hasLogo ? `/api/fiscal/logo?v=${encodeURIComponent(settings.logoUploadedAt ?? settings.updatedAt)}` : null

  return <form action={action} className="space-y-8">
    <Message {...state} />
    <input type="hidden" name="contact_phones_json" value={JSON.stringify(phones.map((value) => value.trim()).filter(Boolean))} />
    <input type="hidden" name="contact_emails_json" value={JSON.stringify(emails.map((value) => value.trim()).filter(Boolean))} />
    <input type="hidden" name="bank_accounts_json" value={JSON.stringify(bankAccounts.filter((item) => item.bank.trim() || item.accountNumber.trim()))} />
    <input type="hidden" name="digital_wallets_json" value={JSON.stringify(wallets.filter((item) => item.provider.trim() || item.phone.trim()))} />

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="provider">Proveedor de emisión</Label>
        <select id="provider" name="provider" defaultValue={settings?.provider ?? 'intifact'} className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900">
          <option value="intifact">Intifact</option>
          <option value="sunat_direct">SUNAT directo</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="environment">Ambiente SUNAT</Label>
        <select id="environment" name="environment" defaultValue={settings?.environment ?? 'beta'} className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900">
          <option value="beta">Beta / pruebas</option>
          <option value="production">Producción</option>
        </select>
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={Building2} title="Datos del emisor" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>RUC emisor</Label><Input value={companyRuc} disabled /></div>
        <div className="space-y-2"><Label htmlFor="trade_name">Nombre comercial</Label><Input id="trade_name" name="trade_name" defaultValue={settings?.tradeName ?? ''} maxLength={250} /></div>
      </div>
      <div className="mt-4 space-y-2"><Label htmlFor="issuer_address">Dirección fiscal / establecimiento</Label><Input id="issuer_address" name="issuer_address" defaultValue={settings?.issuerAddress ?? ''} maxLength={500} /></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="ubigeo">Ubigeo</Label><Input id="ubigeo" name="ubigeo" defaultValue={settings?.ubigeo ?? ''} inputMode="numeric" maxLength={6} placeholder="150101" /></div>
        <div className="space-y-2"><Label htmlFor="department">Departamento</Label><Input id="department" name="department" defaultValue={settings?.department ?? ''} /></div>
        <div className="space-y-2"><Label htmlFor="province">Provincia</Label><Input id="province" name="province" defaultValue={settings?.province ?? ''} /></div>
        <div className="space-y-2"><Label htmlFor="district">Distrito</Label><Input id="district" name="district" defaultValue={settings?.district ?? ''} /></div>
      </div>
      <div className="mt-4 space-y-2"><Label htmlFor="establishment_code">Código de establecimiento SUNAT</Label><Input id="establishment_code" name="establishment_code" defaultValue={settings?.establishmentCode ?? '0000'} maxLength={4} /></div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={Phone} title="Contacto del emisor" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><Label>Teléfonos</Label><Button type="button" size="sm" variant="secondary" disabled={phones.length >= 5} onClick={() => setPhones((items) => [...items, ''])}><Plus className="size-4" />Añadir</Button></div>
          {phones.length === 0 ? <p className="text-sm text-slate-500">Sin teléfonos configurados.</p> : phones.map((phone, index) => <div key={`phone-${index}`} className="flex gap-2"><div className="relative flex-1"><Phone className="absolute left-3 top-3 size-4 text-slate-400"/><Input value={phone} onChange={(event) => setPhones((items) => items.map((item, i) => i === index ? event.target.value : item))} className="pl-9" placeholder="+51 999 999 999" /></div><Button type="button" variant="secondary" size="icon" aria-label="Quitar teléfono" onClick={() => setPhones((items) => items.filter((_, i) => i !== index))}><Trash2 className="size-4"/></Button></div>)}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><Label>Correos</Label><Button type="button" size="sm" variant="secondary" disabled={emails.length >= 5} onClick={() => setEmails((items) => [...items, ''])}><Plus className="size-4" />Añadir</Button></div>
          {emails.length === 0 ? <p className="text-sm text-slate-500">Sin correos configurados.</p> : emails.map((email, index) => <div key={`email-${index}`} className="flex gap-2"><div className="relative flex-1"><Mail className="absolute left-3 top-3 size-4 text-slate-400"/><Input type="email" value={email} onChange={(event) => setEmails((items) => items.map((item, i) => i === index ? event.target.value : item))} className="pl-9" placeholder="facturacion@empresa.pe" /></div><Button type="button" variant="secondary" size="icon" aria-label="Quitar correo" onClick={() => setEmails((items) => items.filter((_, i) => i !== index))}><Trash2 className="size-4"/></Button></div>)}
        </div>
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={ShieldCheck} title="Credenciales SOL"  />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="sol_user">Usuario SOL</Label><Input id="sol_user" name="sol_user" autoComplete="off" placeholder={settings?.hasSolUser ? '••••••' : 'MODDATOS'} /></div>
        <div className="space-y-2"><Label htmlFor="sol_password">Clave SOL</Label><Input id="sol_password" name="sol_password" type="password" autoComplete="new-password" placeholder={settings?.hasSolPassword ? '••••••••' : 'MODDATOS'} /></div>
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={FileKey2} title="Certificado digital" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="certificate">Certificado PFX / P12</Label><Input id="certificate" name="certificate" type="file" accept=".pfx,.p12,application/x-pkcs12" /></div>
        <div className="space-y-2"><Label htmlFor="certificate_password">Contraseña del certificado</Label><Input id="certificate_password" name="certificate_password" type="password" autoComplete="new-password" placeholder={settings?.hasCertificatePassword ? '••••••••' : ''} /></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{settings?.hasCertificate ? `Certificado actual: ${settings.certificateName ?? 'cargado'}${settings.certificateUploadedAt ? ` · ${new Date(settings.certificateUploadedAt).toLocaleString('es-PE')}` : ''}` : 'Aún no hay certificado cargado.'}</p>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={ImageIcon} title="Logo de la empresa"  />
      <div className="grid gap-6 md:grid-cols-[160px_1fr] md:items-start">
        <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          {logoPreview || savedLogoUrl ? <img src={logoPreview ?? savedLogoUrl ?? ''} alt="Logo de la empresa" className="max-h-28 max-w-full object-contain" /> : <div className="text-center text-slate-400"><ImageIcon className="mx-auto size-8"/><p className="mt-2 text-xs">Sin logo</p></div>}
        </div>
        <div className="space-y-3">
          <div className="space-y-2"><Label htmlFor="company_logo">Archivo del logo</Label><Input id="company_logo" name="company_logo" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (!file) return setLogoPreview(null)
            if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
            setLogoPreview(URL.createObjectURL(file))
          }} /></div>
          <p className="text-xs text-slate-500">{settings?.hasLogo ? `Logo actual: ${settings.logoName ?? 'cargado'}${settings.logoUploadedAt ? ` · ${new Date(settings.logoUploadedAt).toLocaleString('es-PE')}` : ''}` : 'Aún no hay logo cargado.'}</p>
          {settings?.hasLogo ? <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="remove_logo" className="size-4 rounded border-slate-300" />Quitar logo actual al guardar</label> : null}
        </div>
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={HardDrive} title="Almacenamiento fiscal en Google Drive"  />
      <div className="space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input type="checkbox" name="drive_enabled" defaultChecked={settings?.driveEnabled ?? false} className="mt-1 size-4 rounded border-slate-300" />
          <span><span className="block text-sm font-semibold text-slate-900">Archivar comprobantes automáticamente en Google Drive</span><span className="mt-1 block text-xs leading-5 text-slate-500">MGL crea MGL Systems / Facturación Electrónica / Año / Tipo / Mes y guarda el PDF, XML y CDR de cada comprobante aceptado.</span></span>
        </label>
        <div className={`rounded-xl border p-3 text-sm ${hasGoogleDrive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {hasGoogleDrive ? <>Google Drive conectado{googleDriveEmail ? ` · ${googleDriveEmail}` : ''}.</> : <>Google Drive todavía no está conectado. <a href="/app/configuracion/integraciones" className="font-semibold underline">Ir a Integraciones</a></>}
        </div>
        {settings?.driveLastSyncError ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">Último error de sincronización: {settings.driveLastSyncError}</p> : null}
        {settings?.driveLastSyncAt ? <p className="text-xs text-slate-500">Última sincronización fiscal: {new Date(settings.driveLastSyncAt).toLocaleString('es-PE')}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="invoice_pdf_format">Formato predeterminado de factura</Label><select id="invoice_pdf_format" name="invoice_pdf_format" defaultValue={settings?.invoicePdfFormat ?? 'a4'} className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900"><option value="a4">A4 · 210 × 297 mm</option><option value="a5">A5 · 148 × 210 mm</option><option value="ticket80">Ticket · 80 mm</option><option value="ticket58">Ticket · 58 mm</option></select></div>
          <div className="space-y-2"><Label htmlFor="receipt_pdf_format">Formato predeterminado de boleta</Label><select id="receipt_pdf_format" name="receipt_pdf_format" defaultValue={settings?.receiptPdfFormat ?? 'ticket80'} className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-900"><option value="a4">A4 · 210 × 297 mm</option><option value="a5">A5 · 148 × 210 mm</option><option value="ticket80">Ticket · 80 mm</option><option value="ticket58">Ticket · 58 mm</option></select></div>
        </div>
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={MessageSquareText} title="Mensajes del PDF" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="pdf_thank_you_message">Mensaje de agradecimiento</Label><textarea id="pdf_thank_you_message" name="pdf_thank_you_message" defaultValue={settings?.pdfThankYouMessage ?? ''} maxLength={300} rows={3} className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900" placeholder="Mensaje" /></div>
        <div className="space-y-2"><Label htmlFor="pdf_additional_message">Mensaje adicional</Label><textarea id="pdf_additional_message" name="pdf_additional_message" defaultValue={settings?.pdfAdditionalMessage ?? ''} maxLength={500} rows={3} className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900" placeholder="Mensaje" /></div>
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={Landmark} title="Cuentas bancarias"  />
      <div className="space-y-4">
        {bankAccounts.map((account, index) => <div key={`bank-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Cuenta {index + 1}</p><Button type="button" variant="secondary" size="sm" onClick={() => setBankAccounts((items) => items.filter((_, i) => i !== index))}><Trash2 className="size-4"/>Quitar</Button></div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5"><Label>Banco</Label><Input value={account.bank} onChange={(event) => setBankAccounts((items) => items.map((item, i) => i === index ? { ...item, bank: event.target.value } : item))} placeholder="BCP" /></div>
            <div className="space-y-1.5"><Label>Tipo de cuenta</Label><Input value={account.accountType} onChange={(event) => setBankAccounts((items) => items.map((item, i) => i === index ? { ...item, accountType: event.target.value } : item))} placeholder="Cuenta corriente" /></div>
            <div className="space-y-1.5"><Label>Moneda</Label><select value={account.currency} onChange={(event) => setBankAccounts((items) => items.map((item, i) => i === index ? { ...item, currency: event.target.value as 'PEN' | 'USD' } : item))} className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm"><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></select></div>
            <div className="space-y-1.5"><Label>Número de cuenta</Label><Input value={account.accountNumber} onChange={(event) => setBankAccounts((items) => items.map((item, i) => i === index ? { ...item, accountNumber: event.target.value } : item))} /></div>
            <div className="space-y-1.5"><Label>CCI</Label><Input value={account.cci} onChange={(event) => setBankAccounts((items) => items.map((item, i) => i === index ? { ...item, cci: event.target.value } : item))} /></div>
            <div className="space-y-1.5"><Label>Titular</Label><Input value={account.holder} onChange={(event) => setBankAccounts((items) => items.map((item, i) => i === index ? { ...item, holder: event.target.value } : item))} /></div>
          </div>
        </div>)}
        <Button type="button" variant="secondary" disabled={bankAccounts.length >= 5} onClick={() => setBankAccounts((items) => [...items, emptyBankAccount()])}><Plus className="size-4"/>Añadir cuenta bancaria</Button>
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <SectionTitle icon={Smartphone} title="Billeteras digitales" />
      <div className="space-y-4">
        {wallets.map((wallet, index) => <div key={`wallet-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5"><Label>Billetera</Label><Input value={wallet.provider} onChange={(event) => setWallets((items) => items.map((item, i) => i === index ? { ...item, provider: event.target.value } : item))} placeholder="Yape" /></div>
          <div className="space-y-1.5"><Label>Teléfono</Label><Input value={wallet.phone} onChange={(event) => setWallets((items) => items.map((item, i) => i === index ? { ...item, phone: event.target.value } : item))} placeholder="999 999 999" /></div>
          <div className="space-y-1.5"><Label>Titular</Label><Input value={wallet.holder} onChange={(event) => setWallets((items) => items.map((item, i) => i === index ? { ...item, holder: event.target.value } : item))} /></div>
          <Button type="button" variant="secondary" size="icon" aria-label="Quitar billetera" onClick={() => setWallets((items) => items.filter((_, i) => i !== index))}><Trash2 className="size-4"/></Button>
        </div>)}
        <Button type="button" variant="secondary" disabled={wallets.length >= 5} onClick={() => setWallets((items) => [...items, emptyWallet()])}><Plus className="size-4"/>Añadir billetera</Button>
      </div>
    </div>

    <SubmitButton pendingLabel="Guardando configuración fiscal..."><ShieldCheck />Guardar configuración fiscal</SubmitButton>
  </form>
}
