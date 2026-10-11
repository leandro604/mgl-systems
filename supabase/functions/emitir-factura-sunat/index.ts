import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import forge from 'npm:node-forge@1.3.1'
import JSZip from 'npm:jszip@3.10.1'
import { SignedXml } from 'npm:xml-crypto@6.1.2'

type Obj = Record<string, unknown>
type FiscalEnvironment = 'beta' | 'production'
type DirectMode = 'emit' | 'status' | 'void' | 'preflight'
type TaxKind = 'gravado' | 'exonerado' | 'inafecto'

type FiscalLine = {
  lineNumber: number
  quantity: number
  unitCode: string
  description: string
  unitValue: number
  lineBase: number
  taxRate: number
  taxAmount: number
  priceWithTax: number
  affectationCode: string
  kind: TaxKind
}

const SUNAT_BETA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService'
const SUNAT_PRODUCTION = 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService'

function object(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function supabaseUrl(): string {
  const value = Deno.env.get('SUPABASE_URL')
  if (!value) throw new Error('SUPABASE_URL missing')
  return value
}

function parseKeySet(name: string): string | null {
  const raw = Deno.env.get(name)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return object(parsed) && typeof parsed.default === 'string' ? parsed.default : null
  } catch {
    return null
  }
}

function adminClient() {
  const key =
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    parseKeySet('SUPABASE_SECRET_KEYS') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!key) throw new Error('Supabase secret key missing')

  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false },
  })
}

function scopedClient(authorization: string) {
  const key =
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    parseKeySet('SUPABASE_PUBLISHABLE_KEYS') ??
    Deno.env.get('SUPABASE_ANON_KEY')

  if (!key) throw new Error('Supabase publishable key missing')

  return createClient(supabaseUrl(), key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function fixed2(value: number): string {
  return round2(value).toFixed(2)
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function cdata(value: string): string {
  return '<![CDATA[' + value.replaceAll(']]>', ']]]]><![CDATA[>') + ']]>'
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function validRuc(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0)
  let check = 11 - (sum % 11)
  if (check === 10) check = 0
  if (check === 11) check = 1
  return check === Number(value[10])
}

function bytesToBinary(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let out = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length))
    out += String.fromCharCode(...chunk)
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
}

function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/^data:[^,]+,/, '').replace(/\s+/g, '')
  const binary = atob(clean)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  return base64ToBytes(base64)
}

async function fiscalEncryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('FISCAL_CREDENTIALS_ENCRYPTION_KEY')
  if (!raw || raw.length < 24) {
    throw new Error('FISCAL_CREDENTIALS_ENCRYPTION_KEY missing in Supabase Edge Function secrets')
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
}

async function decryptSecret(value: string): Promise<string> {
  const trimmed = value.trim()

  let version = ''
  let ivRaw = ''
  let tagRaw = ''
  let encryptedRaw = ''

  if (trimmed.startsWith('{')) {
    const parsed: unknown = JSON.parse(trimmed)
    if (!object(parsed)) throw new Error('Invalid encrypted fiscal credential')
    version = asText(parsed.v || parsed.version, 'v1')
    ivRaw = asText(parsed.iv)
    tagRaw = asText(parsed.tag)
    encryptedRaw = asText(parsed.data || parsed.ciphertext || parsed.encrypted)
  } else {
    const separator = trimmed.includes('.') ? '.' : ':'
    const parts = trimmed.split(separator)
    if (parts.length !== 4) throw new Error('Invalid encrypted fiscal credential')
    ;[version, ivRaw, tagRaw, encryptedRaw] = parts
  }

  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Unsupported encrypted fiscal credential format')
  }

  const iv = fromBase64Url(ivRaw)
  const encrypted = fromBase64Url(encryptedRaw)
  const tag = fromBase64Url(tagRaw)
  const combined = new Uint8Array(encrypted.length + tag.length)
  combined.set(encrypted)
  combined.set(tag, encrypted.length)

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    await fiscalEncryptionKey(),
    combined,
  )

  return new TextDecoder().decode(plain)
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function taxKind(affectationCode: string): TaxKind {
  if (affectationCode === '10') return 'gravado'
  if (affectationCode === '20') return 'exonerado'
  if (affectationCode === '30') return 'inafecto'
  throw new Error('SUNAT directo soporta por ahora afectación IGV 10, 20 y 30. Código recibido: ' + affectationCode)
}

function normalizeLines(rows: unknown[]): FiscalLine[] {
  return rows.map((raw, index) => {
    if (!object(raw)) throw new Error('Invalid invoice item')

    const quantity = asNumber(raw.quantity)
    const unitValue = asNumber(raw.unit_price)
    const taxRate = asNumber(raw.tax_rate)
    const affectationCode = String(raw.tax_affectation_code ?? '10')
    const kind = taxKind(affectationCode)

    if (!(quantity > 0)) throw new Error('Cantidad inválida en partida ' + String(index + 1))
    if (unitValue < 0) throw new Error('Precio unitario inválido en partida ' + String(index + 1))
    if (kind === 'gravado' && !(taxRate > 0)) {
      throw new Error('IGV inválido en partida gravada ' + String(index + 1))
    }

    const lineBase = round2(quantity * unitValue)
    const effectiveTaxRate = kind === 'gravado' ? taxRate : 0
    const taxAmount = round2(lineBase * effectiveTaxRate / 100)
    const priceWithTax = round2(unitValue * (1 + effectiveTaxRate / 100))

    return {
      lineNumber: Math.max(1, Math.trunc(asNumber(raw.line_number, index + 1))),
      quantity,
      unitCode: asText(raw.unit_code, 'NIU').trim().toUpperCase() || 'NIU',
      description: asText(raw.description, 'ITEM').trim() || 'ITEM',
      unitValue,
      lineBase,
      taxRate: effectiveTaxRate,
      taxAmount,
      priceWithTax,
      affectationCode,
      kind,
    }
  })
}

const smallNumbers = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
]

function wordsUnder100(value: number): string {
  if (value < 30) return smallNumbers[value]
  const tens = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const ten = Math.floor(value / 10)
  const unit = value % 10
  return unit === 0 ? tens[ten] : tens[ten] + ' Y ' + smallNumbers[unit]
}

function wordsUnder1000(value: number): string {
  if (value < 100) return wordsUnder100(value)
  if (value === 100) return 'CIEN'
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
  const hundred = Math.floor(value / 100)
  const rest = value % 100
  return hundreds[hundred] + (rest ? ' ' + wordsUnder100(rest) : '')
}

function integerToWords(value: number): string {
  const n = Math.max(0, Math.trunc(value))
  if (n < 1000) return wordsUnder1000(n)
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    const head = thousands === 1 ? 'MIL' : integerToWords(thousands) + ' MIL'
    return head + (rest ? ' ' + wordsUnder1000(rest) : '')
  }
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000)
    const rest = n % 1_000_000
    const head = millions === 1 ? 'UN MILLON' : integerToWords(millions) + ' MILLONES'
    return head + (rest ? ' ' + integerToWords(rest) : '
')
  }
  return String(n)
}

function amountLegend(total: number, currency: string): string {
  const rounded = round2(total)
  const integer = Math.floor(rounded)
  const cents = Math.round((rounded - integer) * 100)
  const currencyName = currency === 'USD' ? 'DOLARES AMERICANOS' : 'SOLES'
  return integerToWords(integer) + ' CON ' + String(cents).padStart(2, '0') + '/100 ' + currencyName
}

function schemeFor(kind: TaxKind): { id: string; name: string; type: string } {
  if (kind === 'gravado') return { id: '1000', name: 'IGV', type: 'VAT' }
  if (kind === 'exonerado') return { id: '9997', name: 'EXO', type: 'VAT' }
  return { id: '9998', name: 'INA', type: 'FRE' }
}

function lineTaxXml(line: FiscalLine, currency: string): string {
  const scheme = schemeFor(line.kind)
  return [
    '<cac:TaxTotal>',
    '<cbc:TaxAmount currencyID="' + currency + '">' + fixed2(line.taxAmount) + '</cbc:TaxAmount>',
    '<cac:TaxSubtotal>',
    '<cbc:TaxableAmount currencyID="' + currency + '">' + fixed2(line.lineBase) + '</cbc:TaxableAmount>',
    '<cbc:TaxAmount currencyID="' + currency + '">' + fixed2(line.taxAmount) + '</cbc:TaxAmount>',
    '<cac:TaxCategory>',
    '<cbc:Percent>' + fixed2(line.taxRate) + '</cbc:Percent>',
    '<cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">' + line.affectationCode + '</cbc:TaxExemptionReasonCode>',
    '<cac:TaxScheme>',
    '<cbc:ID schemeAgencyName="PE:SUNAT" schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">' + scheme.id + '</cbc:ID>',
    '<cbc:Name>' + scheme.name + '</cbc:Name>',
    '<cbc:TaxTypeCode>' + scheme.type + '</cbc:TaxTypeCode>',
    '</cac:TaxScheme>',
    '</cac:TaxCategory>',
    '</cac:TaxSubtotal>',
    '</cac:TaxTotal>',
  ].join('')
}

function headerTaxSubtotal(kind: TaxKind, taxable: number, tax: number, currency: string): string {
  const scheme = schemeFor(kind)
  return [
    '<cac:TaxSubtotal>',
    '<cbc:TaxableAmount currencyID="' + currency + '">' + fixed2(taxable) + '</cbc:TaxableAmount>',
    '<cbc:TaxAmount currencyID="' + currency + '">' + fixed2(tax) + '</cbc:TaxAmount>',
    '<cac:TaxCategory>',
    '<cac:TaxScheme>',
    '<cbc:ID schemeAgencyName="PE:SUNAT" schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">' + scheme.id + '</cbc:ID>',
    '<cbc:Name>' + scheme.name + '</cbc:Name>',
    '<cbc:TaxTypeCode>' + scheme.type + '</cbc:TaxTypeCode>',
    '</cac:TaxScheme>',
    '</cac:TaxCategory>',
    '</cac:TaxSubtotal>',
  ].join('')
}

function buildInvoiceXml(input: {
  issuerRuc: string
  issuerLegalName: string
  tradeName: string
  issuerAddress: string
  ubigeo: string
  department: string
  province: string
  district: string
  establishmentCode: string
  series: string
  number: number
  issuedOn: string
  currency: string
  customerDocumentType: string
  customerDocumentNumber: string
  customerName: string
  customerAddress: string
  lines: FiscalLine[]
}): string {
  const {
    issuerRuc, issuerLegalName, tradeName, issuerAddress, ubigeo, department, province, district,
    establishmentCode, series, number, issuedOn, currency, customerDocumentType,
    customerDocumentNumber, customerName, customerAddress, lines,
  } = input

  const gravadas = round2(lines.filter((line) => line.kind === 'gravado').reduce((sum, line) => sum + line.lineBase, 0))
  const exoneradas = round2(lines.filter((line) => line.kind === 'exonerado').reduce((sum, line) => sum + line.lineBase, 0))
  const inafectas = round2(lines.filter((line) => line.kind === 'inafecto').reduce((sum, line) => sum + line.lineBase, 0))
  const lineExtension = round2(gravadas + exoneradas + inafectas)
  const totalTax = round2(lines.reduce((sum, line) => sum + line.taxAmount, 0))
  const payable = round2(lineExtension + totalTax)
  const documentId = series + '-' + String(number)

  const taxSubtotals = [
    gravadas > 0 ? headerTaxSubtotal('gravado', gravadas, totalTax, currency) : '',
    exoneradas > 0 ? headerTaxSubtotal('exonerado', exoneradas, 0, currency) : '',
    inafectas > 0 ? headerTaxSubtotal('inafecto', inafectas, 0, currency) : '',
  ].join('')

  const customerAddressXml = customerAddress
    ? '<cac:RegistrationAddress><cac:AddressLine><cbc:Line>' + cdata(customerAddress) + '</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country></cac:RegistrationAddress>'
    : ''

  const invoiceLines = lines.map((line) => [
    '<cac:InvoiceLine>',
    '<cbc:ID>' + String(line.lineNumber) + '</cbc:ID>',
    '<cbc:InvoicedQuantity unitCode="' + xmlEscape(line.unitCode) + '" unitCodeListID="UN/ECE rec 20" unitCodeListAgencyName="United Nations Economic Commission for Europe">' + String(line.quantity) + '</cbc:InvoicedQuantity>',
    '<cbc:LineExtensionAmount currencyID="' + currency + '">' + fixed2(line.lineBase) + '</cbc:LineExtensionAmount>',
    '<cac:PricingReference>',
    '<cac:AlternativeConditionPrice>',
    '<cbc:PriceAmount currencyID="' + currency + '">' + fixed2(line.priceWithTax) + '</cbc:PriceAmount>',
    '<cbc:PriceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Precio" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode>',
    '</cac:AlternativeConditionPrice>',
    '</cac:PricingReference>',
    lineTaxXml(line, currency),
    '<cac:Item>',
    '<cbc:Description>' + cdata(line.description) + '</cbc:Description>',
    '<cac:SellersItemIdentification><cbc:ID>MGL-' + String(line.lineNumber) + '</cbc:ID></cac:SellersItemIdentification>',
    '</cac:Item>',
    '<cac:Price><cbc:PriceAmount currencyID="' + currency + '">' + fixed2(line.unitValue) + '</cbc:PriceAmount></cac:Price>',
    '</cac:InvoiceLine>',
  ].join('')).join('')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
    ' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"',
    ' xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
    '<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>',
    '<cbc:UBLVersionID>2.1</cbc:UBLVersionID>',
    '<cbc:CustomizationID schemeAgencyName="PE:SUNAT">2.0</cbc:CustomizationID>',
    '<cbc:ProfileID schemeName="Tipo de Operacion" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo17">0101</cbc:ProfileID>',
    '<cbc:ID>' + xmlEscape(documentId) + '</cbc:ID>',
    '<cbc:IssueDate>' + xmlEscape(issuedOn) + '</cbc:IssueDate>',
    '<cbc:InvoiceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">01</cbc:InvoiceTypeCode>',
    '<cbc:Note languageLocaleID="1000">' + cdata(amountLegend(payable, currency)) + '</cbc:Note>',
    '<cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listName="Currency" listAgencyName="United Nations Economic Commission for Europe">' + currency + '</cbc:DocumentCurrencyCode>',
    '<cbc:LineCountNumeric>' + String(lines.length) + '</cbc:LineCountNumeric>',
    '<cac:Signature>',
    '<cbc:ID>SignatureMGL</cbc:ID>',
    '<cac:SignatoryParty>',
    '<cac:PartyIdentification><cbc:ID>' + issuerRuc + '</cbc:ID></cac:PartyIdentification>',
    '<cac:PartyName><cbc:Name>' + cdata(issuerLegalName) + '</cbc:Name></cac:PartyName>',
    '</cac:SignatoryParty>',
    '<cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#SignatureMGL</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment>',
    '</cac:Signature>',
    '<cac:AccountingSupplierParty>',
    '<cac:Party>',
    '<cac:PartyIdentification>',
    '<cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">' + issuerRuc + '</cbc:ID>',
    '</cac:PartyIdentification>',
    tradeName ? '<cac:PartyName><cbc:Name>' + cdata(tradeName) + '</cbc:Name></cac:PartyName>' : '',
    '<cac:PartyLegalEntity>',
    '<cbc:RegistrationName>' + cdata(issuerLegalName) + '</cbc:RegistrationName>',
    '<cac:RegistrationAddress>',
    '<cbc:ID schemeName="Ubigeos" schemeAgencyName="PE:INEI">' + xmlEscape(ubigeo) + '</cbc:ID>',
    '<cbc:AddressTypeCode listAgencyName="PE:SUNAT" listName="Establecimientos anexos">' + xmlEscape(establishmentCode) + '</cbc:AddressTypeCode>',
    '<cbc:CityName>' + cdata(province) + '</cbc:CityName>',
    '<cbc:CountrySubentity>' + cdata(department) + '</cbc:CountrySubentity>',
    '<cbc:District>' + cdata(district) + '</cbc:District>',
    '<cac:AddressLine><cbc:Line>' + cdata(issuerAddress) + '</cbc:Line></cac:AddressLine>',
    '<cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country>',
    '</cac:RegistrationAddress>',
    '</cac:PartyLegalEntity>',
    '</cac:Party>',
    '</cac:AccountingSupplierParty>',
    '<cac:AccountingCustomerParty>',
    '<cac:Party>',
    '<cac:PartyIdentification>',
    '<cbc:ID schemeID="' + xmlEscape(customerDocumentType) + '" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">' + xmlEscape(customerDocumentNumber) + '</cbc:ID>',
    '</cac:PartyIdentification>',
    '<cac:PartyLegalEntity>',
    '<cbc:RegistrationName>' + cdata(customerName) + '</cbc:RegistrationName>',
    customerAddressXml,
    '</cac:PartyLegalEntity>',
    '</cac:Party>',
    '</cac:AccountingCustomerParty>',
    '<cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Contado</cbc:PaymentMeansID></cac:PaymentTerms>',
    '<cac:TaxTotal>',
    '<cbc:TaxAmount currencyID="' + currency + '">' + fixed2(totalTax) + '</cbc:TaxAmount>',
    taxSubtotals,

    '</cac:TaxTotal>',
    '<cac:LegalMonetaryTotal>',
    '<cbc:LineExtensionAmount currencyID="' + currency + '">' + fixed2(lineExtension) + '</cbc:LineExtensionAmount>',
    '<cbc:TaxInclusiveAmount currencyID="' + currency + '">' + fixed2(payable) + '</cbc:TaxInclusiveAmount>',
    '<cbc:AllowanceTotalAmount currencyID="' + currency + '">0.00</cbc:AllowanceTotalAmount>',
    '<cbc:ChargeTotalAmount currencyID="' + currency + '">0.00</cbc:ChargeTotalAmount>',
    '<cbc:PayableAmount currencyID="' + currency + '">' + fixed2(payable) + '</cbc:PayableAmount>',
    '</cac:LegalMonetaryTotal>',
    invoiceLines,
    '</Invoice>',
  ].join('')
}

function extractPfx(pfxBase64: string, password: string): {
  privateKeyPem: string
  certificatePem: string
  validFrom: Date
  validTo: Date
} {
  const bytes = base64ToBytes(pfxBase64)
  const der = bytesToBinary(bytes)
  const asn1 = forge.asn1.fromDer(der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password)

  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []
  const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []
  const keyBag = [...shrouded, ...plain].find((bag) => bag.key)
  if (!keyBag?.key) throw new Error('El PFX/P12 no contiene una clave privada RSA utilizable')

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []
  const certBag = certBags.find((bag) => bag.cert)
  if (!certBag?.cert) throw new Error('El PFX/P12 no contiene certificado X.509')

  const certificatePem = forge.pki.certificateToPem(certBag.cert)
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key)

  return {
    privateKeyPem,
    certificatePem,
    validFrom: certBag.cert.validity.notBefore,
    validTo: certBag.cert.validity.notAfter,
  }
}

function signInvoiceXml(xml: string, privateKeyPem: string, certificatePem: string): {
  signedXml: string
  digestValue: string
} {
  const signer = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  })

  signer.addReference({
    xpath: '/*',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    isEmptyUri: true,
  })

  signer.computeSignature(xml, {
    prefix: 'ds',
    attrs: { Id: 'SignatureMGL' },
    location: {
      reference: "//*[local-name(.)='ExtensionContent']",
      action: 'append',
    },
  })

  const signedXml = signer.getSignedXml()
  const digestMatch = signedXml.match(/<(?:ds:)?DigestValue>([^<]+)<\/(?:ds:)?DigestValue>/i)
  const signatureMatch = signedXml.match(/<(?:ds:)?SignatureValue>([^<]+)<\/(?:ds:)?SignatureValue>/i)
  const certMatch = signedXml.match(/<(?:ds:)?X509Certificate>([^<]+)<\/(?:ds:)?X509Certificate>/i)

  if (!digestMatch?.[1] || !signatureMatch?.[1] || !certMatch?.[1]) {
    throw new Error('No se pudo construir una firma XMLDSig completa')
  }

  return {
    signedXml,
    digestValue: digestMatch[1].trim(),
  }
}

async function zipSignedXml(fileStem: string, signedXml: string): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(fileStem + '.xml', signedXml)
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

function buildSoapSendBill(fileName: string, zipBase64: string, username: string, password: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
    ' xmlns:ser="http://service.sunat.gob.pe"',
    ' xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">',
    '<soapenv:Header>',
    '<wsse:Security soapenv:mustUnderstand="1">',
    '<wsse:UsernameToken>',
    '<wsse:Username>' + xmlEscape(username) + '</wsse:Username>',
    '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">' + xmlEscape(password) + '</wsse:Password>',
    '</wsse:UsernameToken>',
    '</wsse:Security>',
    '</soapenv:Header>',
    '<soapenv:Body>',
    '<ser:sendBill>',
    '<fileName>' + xmlEscape(fileName) + '</fileName>',
    '<contentFile>' + zipBase64 + '</contentFile>',
    '</ser:sendBill>',
    '</soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('')
}

function soapFault(xml: string): { code: string | null; message: string | null } {
  const code = xml.match(/<(?:\w+:)?faultcode[^>]*>([\s\S]*?)<\/(?:\w+:)?faultcode>/i)?.[1] ?? null
  const message = xml.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i)?.[1] ?? null
  return {
    code: code ? decodeXml(code.trim()) : null,
    message: message ? decodeXml(message.trim()) : null,
  }
}

function applicationResponseBase64(xml: string): string | null {
  const match = xml.match(/<(?:\w+:)?applicationResponse[^>]*>([\s\S]*?)<\/(?:\w+:)?applicationResponse>/i)
  return match?.[1] ? match[1].replace(/\s+/g, '') : null
}

async function parseCdr(zipBytes: Uint8Array): Promise<{
  xml: string
  code: string
  description: string
  notes: string[]
}> {
  const zip = await JSZip.loadAsync(zipBytes)
  const entry = Object.values(zip.files).find((file) => !file.dir && file.name.toLowerCase().endsWith('.xml'))
  if (!entry) throw new Error('SUNAT devolvió un CDR sin XML')
  const xml = await entry.async('string')

  const code =
    xml.match(/<(?:\w+:)?ResponseCode[^>]*>([\s\S]*?)<\/(?:\w+:)?ResponseCode>/i)?.[1]?.trim() ?? ''
  const description =
    xml.match(/<(?:\w+:)?Description[^>]*>([\s\S]*?)<\/(?:\w+:)?Description>/i)?.[1]?.trim() ?? ''
  const notes = Array.from(xml.matchAll(/<(?:\w+:)?Note[^>]*>([\s\S]*?)<\/(?:\w+:)?Note>/gi))
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean)

  if (!code) throw new Error('No se encontró ResponseCode en el CDR de SUNAT')

  return {
    xml,
    code: decodeXml(code),
    description: decodeXml(description),
    notes,
  }
}

async function updateInvoiceError(
  invoiceId: string,
  status: 'draft' | 'submitted' | 'unknown' | 'rejected',
  providerStatus: string,
  message: string,
  extra: Obj = {},
): Promise<void> {
  const admin = adminClient()
  const now = new Date().toISOString()
  const { error } = await admin
    .from('invoices')
    .update({
      status,
      emission_provider: 'sunat_direct',
      provider_status: providerStatus,
      sunat_error: message,
      last_error: message,
      sunat_response_description: message,
      last_sunat_check_at: now,
      updated_at: now,
      mutation_id: crypto.randomUUID(),
      ...extra,
    })
    .eq('id', invoiceId)

  if (error) throw error
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

    const authorization = req.headers.get('authorization') ?? ''
    if (!authorization.toLowerCase().startsWith('bearer ')) {
      return json({ error: 'authentication_required' }, 401)
    }

    const body: unknown = await req.json().catch(() => null)
    const invoiceId = object(body) && typeof body.invoice_id === 'string' ? body.invoice_id : null
    const modeRaw = object(body) && typeof body.mode === 'string' ? body.mode : 'emit'
    const mode: DirectMode = modeRaw === 'status' || modeRaw === 'void' || modeRaw === 'preflight' ? modeRaw : 'emit'

    if (!invoiceId) return json({ error: 'invoice_id_required' }, 400)

    const user = scopedClient(authorization)
    const admin = adminClient()

    const { data: invoiceRaw, error: invoiceError } = await user
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (invoiceError) return json({ error: invoiceError.message }, 400)
    if (!object(invoiceRaw)) return json({ error: 'invoice_not_found' }, 404)

    if (mode === 'preflight') {
      const { data: readiness, error: readinessError } = await user.rpc('sunat_direct_readiness', {
        p_company_id: invoiceRaw.company_id,
      })
      if (readinessError) return json({ error: readinessError.message }, 400)
      return json({
        ok: true,
        readiness,
        edge_encryption_secret_configured: Boolean(Deno.env.get('FISCAL_CREDENTIALS_ENCRYPTION_KEY')),
      })
    }

    if (mode === 'status') {
      return json({
        ok: true,
        status: asText(invoiceRaw.status),
        provider_status: invoiceRaw.provider_status ?? null,
        cdr_code: invoiceRaw.cdr_code ?? null,
        description: invoiceRaw.sunat_response_description ?? null,
        accepted_at: invoiceRaw.accepted_at ?? null,
      })
    }

    if (mode === 'void') {
      return json({
        error: 'sunat_direct_void_not_implemented',
        message: 'La anulación directa se implementará mediante Nota de Crédito / Comunicación de Baja sin alterar Intifact.',
      }, 501)
    }

    if (invoiceRaw.document_type !== '01') {
      return json({
        error: 'sunat_direct_invoice_only',
        message: 'SUNAT directo está habilitado primero para Factura 01. Boleta 03 seguirá por el flujo existente hasta implementar Resumen Diario.',
      }, 409)
    }

    if (invoiceRaw.status === 'accepted' && invoiceRaw.emission_provider === 'sunat_direct') {
      return json({
        ok: true,
        idempotent: true,
        status: 'accepted',
        cdr_code: invoiceRaw.cdr_code ?? '0',
        digest: invoiceRaw.sunat_digest ?? null,
      })
    }

    if (invoiceRaw.status !== 'draft') {
      return json({
        error: 'invoice_not_emittable',
        message: 'El comprobante ya salió de borrador. No se reenviará automáticamente para evitar duplicados.',
        status: invoiceRaw.sta
tus,
      }, 409)
    }

    const { data: settingsRaw, error: settingsError } = await admin
      .from('company_fiscal_settings')
      .select('*')
      .eq('company_id', invoiceRaw.company_id)
      .maybeSingle()

    if (settingsError) return json({ error: settingsError.message }, 400)
    if (!object(settingsRaw)) {
      return json({ error: 'fiscal_settings_required', message: 'Configura Facturación antes de emitir.' }, 409)
    }
    if (settingsRaw.provider !== 'sunat_direct') {
      return json({ error: 'sunat_direct_not_selected', message: 'El proveedor fiscal de la empresa no es SUNAT directo.' }, 409)
    }

    const environment: FiscalEnvironment = settingsRaw.environment === 'production' ? 'production' : 'beta'

    const { data: companyRaw, error: companyError } = await user
      .from('companies')
      .select('ruc,legal_name')
      .eq('id', invoiceRaw.company_id)
      .single()

    if (companyError || !object(companyRaw)) {
      return json({ error: companyError?.message ?? 'company_not_found' }, 400)
    }

    const issuerRuc = asText(companyRaw.ruc).trim()
    const issuerLegalName = asText(companyRaw.legal_name).trim()
    if (!validRuc(issuerRuc)) {
      return json({ error: 'invalid_issuer_ruc', message: 'El RUC emisor no pasa la validación módulo 11.' }, 409)
    }

    const customerDocumentType = asText(invoiceRaw.customer_document_type)
    const customerDocumentNumber = asText(invoiceRaw.customer_document_number)
    if (customerDocumentType !== '6' || !validRuc(customerDocumentNumber)) {
      return json({ error: 'invalid_customer_ruc', message: 'Factura 01 requiere cliente con RUC válido.' }, 409)
    }

    const requiredFiscalFields = [
      ['issuer_address', asText(settingsRaw.issuer_address)],
      ['ubigeo', asText(settingsRaw.ubigeo)],
      ['department', asText(settingsRaw.department)],
      ['province', asText(settingsRaw.province)],
      ['district', asText(settingsRaw.district)],
      ['establishment_code', asText(settingsRaw.establishment_code)],
    ] as const

    const missingFiscal = requiredFiscalFields.filter(([, value]) => !value.trim()).map(([name]) => name)
    if (missingFiscal.length) {
      return json({
        error: 'incomplete_fiscal_settings',
        message: 'Faltan datos fiscales: ' + missingFiscal.join(', '),
      }, 409)
    }

    if (typeof settingsRaw.certificate_pfx_enc !== 'string' || typeof settingsRaw.certificate_password_enc !== 'string') {
      return json({
        error: 'certificate_required',
        message: 'Carga el certificado digital PFX/P12 y su contraseña.',
      }, 409)
    }

    const [certificateBase64, certificatePassword] = await Promise.all([
      decryptSecret(settingsRaw.certificate_pfx_enc),
      decryptSecret(settingsRaw.certificate_password_enc),
    ])

    const certificate = extractPfx(certificateBase64, certificatePassword)
    const nowDate = new Date()
    if (nowDate < certificate.validFrom || nowDate > certificate.validTo) {
      return json({
        error: 'certificate_not_valid_now',
        message: 'El certificado digital no está vigente.',
        valid_from: certificate.validFrom.toISOString(),
        valid_to: certificate.validTo.toISOString(),
      }, 409)
    }

    let solUser = ''
    let solPassword = ''

    if (environment === 'beta') {
      solUser = 'MODDATOS'
      solPassword = 'MODDATOS'
      if (typeof settingsRaw.sol_user_enc === 'string' && typeof settingsRaw.sol_password_enc === 'string') {
        try {
          solUser = (await decryptSecret(settingsRaw.sol_user_enc)).trim() || solUser
          solPassword = (await decryptSecret(settingsRaw.sol_password_enc)).trim() || solPassword
        } catch {
          solUser = 'MODDATOS'
          solPassword = 'MODDATOS'
        }
      }
    } else {
      if (typeof settingsRaw.sol_user_enc !== 'string' || typeof settingsRaw.sol_password_enc !== 'string') {
        return json({
          error: 'sol_credentials_required',
          message: 'Producción requiere usuario SOL secundario y Clave SOL.',
        }, 409)
      }
      solUser = (await decryptSecret(settingsRaw.sol_user_enc)).trim()
      solPassword = (await decryptSecret(settingsRaw.sol_password_enc)).trim()
      if (!solUser || !solPassword) {
        return json({ error: 'sol_credentials_required', message: 'Credenciales SOL incompletas.' }, 409)
      }
    }

    const { data: itemsRaw, error: itemsError } = await user
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('line_number')

    if (itemsError) return json({ error: itemsError.message }, 400)
    const rawItems: unknown[] = Array.isArray(itemsRaw) ? itemsRaw : []
    if (!rawItems.length) return json({ error: 'invoice_items_required' }, 409)

    if ((!invoiceRaw.series || invoiceRaw.number === null) && invoiceRaw.status === 'draft') {
      const { error: prepareError } = await user.rpc('prepare_invoice_emission', { p_invoice_id: invoiceId })
      if (prepareError) return json({ error: prepareError.message }, 400)
    }

    const { data: preparedRaw, error: preparedError } = await user
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (preparedError || !object(preparedRaw) || !preparedRaw.series || preparedRaw.number === null) {
      return json({ error: preparedError?.message ?? 'invoice_prepare_failed' }, 400)
    }

    const lines = normalizeLines(rawItems)
    const signed = signInvoiceXml(
      buildInvoiceXml({
        issuerRuc,
        issuerLegalName,
        tradeName: asText(settingsRaw.trade_name).trim(),
        issuerAddress: asText(settingsRaw.issuer_address).trim(),
        ubigeo: asText(settingsRaw.ubigeo).trim(),
        department: asText(settingsRaw.department).trim(),
        province: asText(settingsRaw.province).trim(),
        district: asText(settingsRaw.district).trim(),
        establishmentCode: asText(settingsRaw.establishment_code, '0000').trim() || '0000',
        series: asText(preparedRaw.series),
        number: asNumber(preparedRaw.number),
        issuedOn: asText(preparedRaw.issued_on),
        currency: asText(preparedRaw.currency, 'PEN'),
        customerDocumentType,
        customerDocumentNumber,
        customerName: asText(preparedRaw.customer_name),
        customerAddress: asText(preparedRaw.customer_address),
        lines,
      }),
      certificate.privateKeyPem,
      certificate.certificatePem,
    )

    const fileStem =
      issuerRuc + '-01-' + asText(preparedRaw.series) + '-' + String(asNumber(preparedRaw.number))
    const zipBytes = await zipSignedXml(fileStem, signed.signedXml)
    const zipBase64 = bytesToBase64(zipBytes)

    const normalizedSolUser = solUser.toUpperCase().startsWith(issuerRuc)
      ? solUser.toUpperCase()
      : issuerRuc + solUser.toUpperCase()

    const soap = buildSoapSendBill(
      fileStem + '.zip',
      zipBase64,
      normalizedSolUser,
      solPassword,
    )

    const sentAt = new Date().toISOString()
    const { error: markSendingError } = await admin
      .from('invoices')
      .update({
        status: 'submitted',
        emission_provider: 'sunat_direct',
        provider_status: 'ENVIANDO_SUNAT',
        sunat_xml: signed.signedXml,
        sunat_digest: signed.digestValue,
        sunat_sent_at: sentAt,
        last_sunat_check_at: sentAt,
        sunat_error: null,
        last_error: null,
        updated_at: sentAt,
        mutation_id: crypto.randomUUID(),
      })
      .eq('id', invoiceId)

    if (markSendingError) throw markSendingError

    const endpoint = environment === 'production' ? SUNAT_PRODUCTION : SUNAT_BETA

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'text/xml; charset=utf-8',
          SOAPAction: '""',
        },
        body: soap,
        signal: AbortSignal.timeout(45000),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo conectar con SUNAT'
      await updateInvoiceError(invoiceId, 'unknown', 'SUNAT_SIN_CONFIRMAR', message, {
        sunat_xml: signed.signedXml,
        sunat_digest: signed.digestValue,
      })
      return json({
        ok: false,
        status: 'unknown',
        error: 'sunat_transport_unknown',
        message: 'No se confirmó la respuesta de SUNAT. No reenvíes automáticamente el comprobante.',
      }, 502)
    }

    const responseText = await response.text()
    const fault = soapFault(responseText)
    const applicationResponse = applicationResponseBase64(responseText)

    if (fault.message || !applicationResponse) {
      const message = fault.message || ('SUNAT HTTP ' + String(response.status) + ' sin applicationResponse')
      const definitive = Boolean(fault.message)
      await updateInvoiceError(
        invoiceId,
        definitive ? 'rejected' : 'unknown',
        definitive ? 'RECHAZADO_SOAP' : 'SUNAT_SIN_CONFIRMAR',
        message,
        {
          pse_response: {
            provider: 'sunat_direct',
            environment,
            http_status: response.status,
            fault_code: fault.code,
          },
          sunat_xml: signed.signedXml,
          sunat_digest: signed.digestValue,
        },
      )

      return json({
        ok: false,
        status: definitive ? 'rejected' : 'unknown',
        error: fault.code ?? 'sunat_no_application_response',
        message,
      }, definitive ? 400 : 502)
    }

    const cdrZipBytes = base64ToBytes(applicationResponse)
    const cdr = await parseCdr(cdrZipBytes)
    const cdrHash = await sha256Hex(cdrZipBytes)
    const accepted = cdr.code === '0'
    const completedAt = new Date().toISOString()
    const responseDescription = [cdr.description, ...cdr.notes].filter(Boolean).join(' | ')

    const { error: completeError } = await admin
      .from('invoices')
    
  .update({
        status: accepted ? 'accepted' : 'rejected',
        emission_provider: 'sunat_direct',
        provider_status: accepted ? 'ACEPTADO' : 'RECHAZADO',
        cdr_code: cdr.code,
        cdr_xml: cdr.xml,
        cdr_hash: cdrHash,
        sunat_cdr_zip_base64: applicationResponse,
        sunat_xml: signed.signedXml,
        sunat_digest: signed.digestValue,
        sunat_response_description: responseDescription,
        accepted_at: accepted ? completedAt : null,
        sunat_error: accepted ? null : responseDescription || 'SUNAT rechazó el comprobante',
        last_error: accepted ? null : responseDescription || 'SUNAT rechazó el comprobante',
        last_sunat_check_at: completedAt,
        pse_response: {
          provider: 'sunat_direct',
          environment,
          http_status: response.status,
          response_code: cdr.code,
          notes: cdr.notes,
        },
        updated_at: completedAt,
        mutation_id: crypto.randomUUID(),
      })
      .eq('id', invoiceId)

    if (completeError) throw completeError

    return json({
      ok: accepted,
      status: accepted ? 'accepted' : 'rejected',
      provider: 'sunat_direct',
      environment,
      cdr_code: cdr.code,
      description: cdr.description,
      notes: cdr.notes,
      digest: signed.digestValue,
      certificate_valid_to: certificate.validTo.toISOString(),
    }, accepted ? 200 : 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SUNAT direct internal error'
    return json({ error: 'sunat_direct_internal_error', message }, 500)
  }
})

