import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import forge from 'npm:node-forge@1.3.1'
import { SignedXml } from 'npm:xml-crypto@6.1.2'
import JSZip from 'npm:jszip@3.10.2'

type JsonObject = Record<string, unknown>
type AdminClient = SupabaseClient

const INTIFACT_BASE = 'https://api-facturacion.intifact.com'
const SUNAT_BETA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService'
const SUNAT_PROD = 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}
function isObject(value: unknown): value is JsonObject { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100 }
function escapeXml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
function cleanPem(value: string) { return value.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '') }
function base64UrlBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const raw = atob(normalized)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
function concatBytes(...chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0))
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return out
}
async function decryptSecret(value: string) {
  const rawKey = Deno.env.get('FISCAL_CREDENTIALS_ENCRYPTION_KEY')
  if (!rawKey || rawKey.length < 24) throw new Error('fiscal_encryption_key_missing')
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split('.')
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) throw new Error('invalid_fiscal_secret')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey))
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlBytes(ivRaw), tagLength: 128 }, key, concatBytes(base64UrlBytes(encryptedRaw), base64UrlBytes(tagRaw)))
  return new TextDecoder().decode(decrypted)
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function buildDetail(items: JsonObject[]) {
  return items.map((item) => {
    const qty = Number(item.quantity)
    const netUnit = Number(item.unit_price)
    const taxRate = Number(item.tax_rate)
    const base = round2(qty * netUnit)
    const tax = round2((base * taxRate) / 100)
    return {
      unidad: String(item.unit_code ?? 'NIU'), cantidad: qty, codProducto: `MGL-${item.line_number}`,
      descripcion: String(item.description ?? ''), montoValorUnitario: netUnit, montoBaseIgv: base,
      porcentajeIgv: taxRate, igv: tax, tipAfeIgv: String(item.tax_affectation_code ?? '10'), totalImpuestos: tax,
      montoPrecioUnitario: round2(netUnit * (1 + taxRate / 100)), montoValorVenta: base,
    }
  })
}

function ublInvoiceXml(invoice: JsonObject, company: JsonObject, fiscal: JsonObject, detail: ReturnType<typeof buildDetail>) {
  const gravadas = round2(detail.reduce((sum, row) => sum + row.montoValorVenta, 0))
  const igv = round2(detail.reduce((sum, row) => sum + row.igv, 0))
  const total = round2(gravadas + igv)
  const seriesNumber = `${invoice.series}-${invoice.number}`
  const currency = String(invoice.currency ?? 'PEN')
  const ruc = String(company.ruc ?? '')
  const legalName = escapeXml(company.legal_name)
  const tradeName = escapeXml(fiscal.trade_name || company.legal_name)
  const address = escapeXml(fiscal.issuer_address)
  const ubigeo = escapeXml(fiscal.ubigeo)
  const department = escapeXml(fiscal.department)
  const province = escapeXml(fiscal.province)
  const district = escapeXml(fiscal.district)
  const establishment = escapeXml(fiscal.establishment_code || '0000')
  const customerType = escapeXml(invoice.customer_document_type)
  const customerNumber = escapeXml(invoice.customer_document_number)
  const customerName = escapeXml(invoice.customer_name)
  const customerAddress = escapeXml(invoice.customer_address)
  const issueTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())

  const lines = detail.map((row, index) => `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${escapeXml(row.unidad)}" unitCodeListID="UN/ECE rec 20" unitCodeListAgencyName="United Nations Economic Commission for Europe">${row.cantidad.toFixed(4)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${row.montoValorVenta.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:PricingReference><cac:AlternativeConditionPrice><cbc:PriceAmount currencyID="${currency}">${row.montoPrecioUnitario.toFixed(6)}</cbc:PriceAmount><cbc:PriceTypeCode listName="Tipo de Precio" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode></cac:AlternativeConditionPrice></cac:PricingReference>
    <cac:TaxTotal><cbc:TaxAmount currencyID="${currency}">${row.igv.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${currency}">${row.montoBaseIgv.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${currency}">${row.igv.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID schemeID="UN/ECE 5305" schemeName="Tax Category Identifier" schemeAgencyName="United Nations Economic Commission for Europe">S</cbc:ID><cbc:Percent>${row.porcentajeIgv.toFixed(2)}</cbc:Percent><cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${escapeXml(row.tipAfeIgv)}</cbc:TaxExemptionReasonCode><cac:TaxScheme><cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
    <cac:Item><cbc:Description><![CDATA[${String(row.descripcion).replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${currency}">${row.montoValorUnitario.toFixed(6)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID schemeAgencyName="PE:SUNAT">2.0</cbc:CustomizationID>
  <cbc:ProfileID schemeName="Tipo de Operacion" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51">0101</cbc:ProfileID>
  <cbc:ID>${escapeXml(seriesNumber)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(invoice.issued_on)}</cbc:IssueDate>
  <cbc:IssueTime>${escapeXml(issueTime)}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listID="0101" listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listName="Currency" listAgencyName="United Nations Economic Commission for Europe">${currency}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${detail.length}</cbc:LineCountNumeric>
  <cac:Signature><cbc:ID>${escapeXml(`IDSign-${seriesNumber}`)}</cbc:ID><cac:SignatoryParty><cac:PartyIdentification><cbc:ID>${ruc}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name><![CDATA[${String(company.legal_name ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></cbc:Name></cac:PartyName></cac:SignatoryParty><cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>${escapeXml(`#Signature-${seriesNumber}`)}</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${ruc}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name><![CDATA[${String(fiscal.trade_name || company.legal_name || '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:RegistrationName><![CDATA[${String(company.legal_name ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></cbc:RegistrationName><cbc:CompanyID schemeID="6" schemeName="SUNAT:Identificador de Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${ruc}</cbc:CompanyID><cac:TaxScheme><cbc:ID schemeID="6" schemeName="SUNAT:Identificador de Documento de Identidad" schemeAgencyName="PE:SUNAT">${ruc}</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName><![CDATA[${String(company.legal_name ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></cbc:RegistrationName><cac:RegistrationAddress><cbc:ID schemeName="Ubigeos" schemeAgencyName="PE:INEI">${ubigeo}</cbc:ID><cbc:AddressTypeCode listAgencyName="PE:SUNAT" listName="Establecimientos anexos">${establishment}</cbc:AddressTypeCode><cbc:CityName>${province}</cbc:CityName><cbc:CountrySubentity>${department}</cbc:CountrySubentity><cbc:District>${district}</cbc:District><cac:AddressLine><cbc:Line>${address}</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode listID="ISO 3166-1" listAgencyName="United Nations Economic Commission for Europe" listName="Country">PE</cbc:IdentificationCode></cac:Country></cac:RegistrationAddress></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="${customerType}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${customerNumber}</cbc:ID></cac:PartyIdentification><cac:PartyLegalEntity><cbc:RegistrationName><![CDATA[${String(invoice.customer_name ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></cbc:RegistrationName>${customerAddress ? `<cac:RegistrationAddress><cac:AddressLine><cbc:Line>${customerAddress}</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country></cac:RegistrationAddress>` : ''}</cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Contado</cbc:PaymentMeansID></cac:PaymentTerms>
  <cac:TaxTotal><cbc:TaxAmount currencyID="${currency}">${igv.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${currency}">${gravadas.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${currency}">${igv.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID schemeID="UN/ECE 5305" schemeName="Tax Category Identifier" schemeAgencyName="United Nations Economic Commission for Europe">S</cbc:ID><cac:TaxScheme><cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${currency}">${gravadas.toFixed(2)}</cbc:LineExtensionAmount><cbc:TaxInclusiveAmount currencyID="${currency}">${total.toFixed(2)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${currency}">${total.toFixed(2)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}
</Invoice>`
}

function pfxCredentials(pfxBase64: string, password: string) {
  const der = forge.util.decode64(pfxBase64)
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, password)
  const keyOid = forge.pki.oids.pkcs8ShroudedKeyBag
  const plainKeyOid = forge.pki.oids.keyBag
  const certOid = forge.pki.oids.certBag
  const shrouded = p12.getBags({ bagType: keyOid })[keyOid] ?? []
  const plain = p12.getBags({ bagType: plainKeyOid })[plainKeyOid] ?? []
  const certs = p12.getBags({ bagType: certOid })[certOid] ?? []
  const keyBag = shrouded[0] ?? plain[0]
  const certBag = certs[0]
  if (!keyBag?.key || !certBag?.cert) throw new Error('certificate_key_not_found')
  return { privateKey: forge.pki.privateKeyToPem(keyBag.key), certificate: forge.pki.certificateToPem(certBag.cert) }
}

function signUbl(xml: string, privateKey: string, certificate: string, signatureId: string) {
  const signer = new SignedXml({
    privateKey,
    publicCert: certificate,
    getKeyInfoContent: SignedXml.getKeyInfoContent,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  })
  signer.addReference({
    xpath: "/*",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    isEmptyUri: true,
  })
  signer.computeSignature(xml, {
    prefix: 'ds',
    attrs: { Id: signatureId },
    location: { reference: "//*[local-name(.)='ExtensionContent']", action: 'append' },
    existingPrefixes: {
      ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    },
  })
  return signer.getSignedXml()
}

function soapEnvelope(username: string, password: string, fileName: string, zipBase64: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext"><soapenv:Header><wsse:Security><wsse:UsernameToken><wsse:Username>${escapeXml(username)}</wsse:Username><wsse:Password>${escapeXml(password)}</wsse:Password></wsse:UsernameToken></wsse:Security></soapenv:Header><soapenv:Body><ser:sendBill><fileName>${escapeXml(fileName)}</fileName><contentFile>${zipBase64}</contentFile></ser:sendBill></soapenv:Body></soapenv:Envelope>`
}
function xmlTag(xml: string, localName: string) {
  const match = xml.match(new RegExp(`<(?:[A-Za-z0-9_-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${localName}>`, 'i'))
  return match?.[1]?.trim() ?? null
}
function decodeXmlText(value: string | null) {
  return (value ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

async function emitSunatDirect(admin: AdminClient, invoice: JsonObject, items: JsonObject[], company: JsonObject, fiscal: JsonObject) {
  if (invoice.document_type !== '01') return { ok: false, status: 409, body: { error: 'boleta_requires_daily_summary', detail: 'SUNAT directo v0.16.0 emite facturas 01. Las boletas continúan por Intifact hasta implementar Resumen Diario.' } }
  if (!invoice.series || invoice.number === null) return { ok: false, status: 409, body: { error: 'invoice_number_required' } }
  if (!fiscal.certificate_pfx_enc) return { ok: false, status: 409, body: { error: 'sunat_certificate_required' } }
  if (!fiscal.certificate_password_enc) return { ok: false, status: 409, body: { error: 'sunat_certificate_password_required' } }

  const environment = fiscal.environment === 'production' ? 'production' : 'beta'
  const solUser = fiscal.sol_user_enc ? await decryptSecret(String(fiscal.sol_user_enc)) : environment === 'beta' ? 'MODDATOS' : ''
  const solPassword = fiscal.sol_password_enc ? await decryptSecret(String(fiscal.sol_password_enc)) : environment === 'beta' ? 'MODDATOS' : ''
  if (!solUser || !solPassword) return { ok: false, status: 409, body: { error: 'sunat_sol_credentials_required' } }
  const pfxBase64 = await decryptSecret(String(fiscal.certificate_pfx_enc))
  const pfxPassword = await decryptSecret(String(fiscal.certificate_password_enc))

  const detail = buildDetail(items)
  const unsignedXml = ublInvoiceXml(invoice, company, fiscal, detail)
  const { privateKey, certificate } = pfxCredentials(pfxBase64, pfxPassword)
  const signatureId = `Signature-${invoice.series}-${invoice.number}`
  const signedXml = signUbl(unsignedXml, privateKey, certificate, signatureId)
  const digest = xmlTag(signedXml, 'DigestValue') ?? await sha256(signedXml)
  const base = `${company.ruc}-01-${invoice.series}-${invoice.number}`
  const xmlName = `${base}.xml`
  const zipName = `${base}.zip`
  const zip = new JSZip()
  zip.file(xmlName, signedXml)
  const zipBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } })

  await admin.from('invoices').update({
    status: 'processing', emission_provider: 'sunat_direct', provider_status: `SUNAT_${environment.toUpperCase()}_ENVIANDO`,
    sunat_xml: signedXml, sunat_digest: digest, last_error: null, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
  }).eq('id', invoice.id)

  const endpoint = environment === 'production' ? SUNAT_PROD : SUNAT_BETA
  const username = `${company.ruc}${solUser}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'text/xml; charset=utf-8', SOAPAction: '"sendBill"' },
    body: soapEnvelope(username, solPassword, zipName, zipBase64),
  })
  const responseXml = await response.text()
  const fault = decodeXmlText(xmlTag(responseXml, 'faultstring'))
  if (!response.ok || fault) {
    const message = fault || `SUNAT HTTP ${response.status}`
    await admin.from('invoices').update({ status: response.status >= 400 && response.status < 500 ? 'rejected' : 'unknown', provider_status: 'SUNAT_ERROR', last_error: message, pse_response: { endpoint, environment, http_status: response.status, fault: message }, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', invoice.id)
    return { ok: false, status: response.status >= 400 && response.status < 500 ? 400 : 502, body: { error: message, provider: 'sunat_direct' } }
  }

  const applicationResponse = xmlTag(responseXml, 'applicationResponse')
  if (!applicationResponse) {
    await admin.from('invoices').update({ status: 'unknown', provider_status: 'SUNAT_SIN_CDR', last_error: 'SUNAT no devolvió applicationResponse.', pse_response: { endpoint, environment, response: responseXml.slice(0, 4000) }, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', invoice.id)
    return { ok: false, status: 502, body: { error: 'sunat_cdr_missing', provider: 'sunat_direct' } }
  }

  const cdrZip = await JSZip.loadAsync(applicationResponse.replace(/\s+/g, ''), { base64: true })
  const cdrEntry = Object.values(cdrZip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith('.xml'))
  if (!cdrEntry) throw new Error('sunat_cdr_xml_missing')
  const cdrXml = await cdrEntry.async('string')
  const cdrCode = decodeXmlText(xmlTag(cdrXml, 'ResponseCode')) || 'UNKNOWN'
  const cdrDescription = decodeXmlText(xmlTag(cdrXml, 'Description')) || ''
  const accepted = cdrCode === '0'

  await admin.from('invoices').update({
    status: accepted ? 'accepted' : 'rejected', emission_provider: 'sunat_direct', provider_status: accepted ? 'ACEPTADO' : 'RECHAZADO',
    cdr_code: cdrCode, cdr_xml: cdrXml, sunat_cdr_zip_base64: applicationResponse.replace(/\s+/g, ''),
    sunat_response_description: cdrDescription, accepted_at: accepted ? new Date().toISOString() : null,
    last_error: accepted ? null : cdrDescription || `SUNAT código ${cdrCode}`,
    pse_request_id: base, pse_response: { endpoint, environment, cdr_code: cdrCode, description: cdrDescription },
    updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
  }).eq('id', invoice.id)

  return { ok: accepted, status: accepted ? 200 : 400, body: { ok: accepted, provider: 'sunat_direct', environment, cdr_code: cdrCode, description: cdrDescription, digest } }
}

async function emitIntifact(admin: AdminClient, invoice: JsonObject, items: JsonObject[], company: JsonObject, apiKey: string) {
  const detail = buildDetail(items)
  const gravadas = round2(detail.reduce((sum, row) => sum + row.montoValorVenta, 0))
  const igv = round2(detail.reduce((sum, row) => sum + row.igv, 0))
  const total = round2(gravadas + igv)
  const payload = {
    empresaRuc: company.ruc, tipoDoc: invoice.document_type, serie: invoice.series, correlativo: String(invoice.number), tipoMoneda: invoice.currency,
    fechaEmision: invoice.issued_on, tipoOperacion: '0101', establecimientoCodigo: '0000', clienteTipoDoc: invoice.customer_document_type,
    clienteNumDoc: invoice.customer_document_number, clienteRazonSocial: invoice.customer_name, clienteDireccion: invoice.customer_address, detalle,
    montoOperGravadas: gravadas, montoOperExoneradas: 0, montoOperInafectas: 0, montoOperGratuitas: 0, montoIgv: igv, totalImpuestos: igv,
    valorVenta: gravadas, subTotal: total, montoImpVenta: total, formaPago: [{ tipo: 'Contado', monto: total, fechaPago: invoice.issued_on }],
  }
  const hash = await sha256(`${invoice.id}:${JSON.stringify(payload)}`)
  if (invoice.intifact_idempotency_hash === hash && invoice.intifact_document_id) {
    const providerStatus = String(invoice.provider_status ?? '').toUpperCase()
    if (!providerStatus.includes('COLA_FALLIDA')) return { ok: true, status: 200, body: { ok: true, idempotent: true, provider: 'intifact', document_id: invoice.intifact_document_id, status: invoice.provider_status ?? invoice.status } }
    const retryResponse = await fetch(`${INTIFACT_BASE}/api/v1/documents/${encodeURIComponent(String(invoice.intifact_document_id))}/retry`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` } })
    const retryRaw = (await retryResponse.json().catch(() => ({}))) as unknown
    const retryResult = isObject(retryRaw) ? retryRaw : {}
    if (!retryResponse.ok || retryResult.success === false) return { ok: false, status: 502, body: { ok: false, error: typeof retryResult.message === 'string' ? retryResult.message : `Intifact retry HTTP ${retryResponse.status}`, provider: 'intifact' } }
    await admin.from('invoices').update({ status: 'submitted', emission_provider: 'intifact', provider_status: 'ENCOLADO', pse_response: retryResult, last_error: null, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', invoice.id)
    return { ok: true, status: 200, body: { ok: true, provider: 'intifact', retried: true, document_id: invoice.intifact_document_id, status: 'ENCOLADO' } }
  }

  await admin.from('invoices').update({ status: 'processing', emission_provider: 'intifact', intifact_idempotency_hash: hash, last_error: null, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', invoice.id)
  const response = await fetch(`${INTIFACT_BASE}/api/v1/invoice/send`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': hash }, body: JSON.stringify(payload) })
  const raw = (await response.json().catch(() => ({}))) as unknown
  const result = isObject(raw) ? raw : {}
  const data = isObject(result.data) ? result.data : result
  const documentId = typeof data.id === 'string' ? data.id : typeof data.documentId === 'string' ? data.documentId : null
  const providerStatus = typeof data.estado === 'string' ? data.estado : typeof data.estadoSunat === 'string' ? data.estadoSunat : typeof data.status === 'string' ? data.status : 'ENCOLADO'
  const providerCdrCode = typeof data.codigoRespuesta === 'string' ? data.codigoRespuesta : typeof data.cdrCode === 'string' ? data.cdrCode : typeof data.cdr_code === 'string' ? data.cdr_code : null
  if ((!response.ok || result.success === false) && response.status !== 409) {
    const message = typeof result.message === 'string' ? result.message : `Intifact HTTP ${response.status}`
    await admin.from('invoices').update({ status: response.status >= 400 && response.status < 500 ? 'rejected' : 'unknown', emission_provider: 'intifact', provider_status: 'ERROR', pse_response: result, last_error: message, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', invoice.id)
    return { ok: false, status: response.status >= 400 && response.status < 500 ? 400 : 502, body: { ok: false, error: message, provider: 'intifact' } }
  }
  const acceptedByProvider = providerStatus.toUpperCase() === 'ACEPTADO' && Boolean(documentId)
  await admin.from('invoices').update({
    status: acceptedByProvider ? 'accepted' : providerStatus.toUpperCase() === 'RECHAZADO' ? 'rejected' : 'submitted',
    emission_provider: 'intifact', intifact_document_id: documentId, provider_status: providerStatus, pse_request_id: documentId, pse_response: result,
    cdr_code: acceptedByProvider ? (providerCdrCode ?? '0') : providerCdrCode,
    accepted_at: acceptedByProvider ? new Date().toISOString() : null, last_error: null, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
  }).eq('id', invoice.id)
  return { ok: true, status: 200, body: { ok: true, provider: 'intifact', document_id: documentId, status: providerStatus, hash } }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) return json({ error: 'authentication_required' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return json({ error: 'supabase_env_missing' }, 500)
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const admin = createClient(url, service, { auth: { persistSession: false } })

  const body = (await req.json().catch(() => null)) as unknown
  const invoiceId = isObject(body) && typeof body.invoice_id === 'string' ? body.invoice_id : null
  if (!invoiceId) return json({ error: 'invoice_id_required' }, 400)
  const { data: invoice, error: invoiceError } = await userClient.from('invoices').select('*').eq('id', invoiceId).is('deleted_at', null).maybeSingle()
  if (invoiceError) return json({ error: 'invoice_read_failed', detail: invoiceError.message }, 400)
  if (!invoice) return json({ error: 'invoice_not_found' }, 404)
  if (!['queued', 'processing', 'submitted', 'unknown'].includes(invoice.status)) return json({ error: 'invoice_not_queued' }, 409)
  if (!invoice.series || invoice.number === null) return json({ error: 'invoice_number_required' }, 409)

  const [{ data: items, error: itemsError }, { data: company, error: companyError }, fiscalResult] = await Promise.all([
    userClient.from('invoice_items').select('*').eq('invoice_id', invoiceId).is('deleted_at', null).order('line_number'),
    userClient.from('companies').select('ruc,legal_name').eq('id', invoice.company_id).single(),
    admin.from('company_fiscal_settings').select('*').eq('company_id', invoice.company_id).maybeSingle(),
  ])
  if (itemsError || companyError) return json({ error: 'invoice_data_failed', detail: itemsError?.message ?? companyError?.message }, 400)
  if (!items?.length) return json({ error: 'invoice_items_required' }, 409)

  const fiscal = fiscalResult.error ? null : fiscalResult.data
  const provider = fiscal?.provider === 'sunat_direct' ? 'sunat_direct' : 'intifact'
  try {
    if (provider === 'sunat_direct' && invoice.document_type === '01') {
      const result = await emitSunatDirect(admin, invoice as JsonObject, items as JsonObject[], company as JsonObject, fiscal as JsonObject)
      return json(result.body, result.status)
    }
    const apiKey = Deno.env.get('INTIFACT_API_KEY')
    if (!apiKey) {
      if (provider === 'sunat_direct' && invoice.document_type === '03') return json({ error: 'boleta_requires_daily_summary', detail: 'Configura Intifact para boletas mientras se implementa Resumen Diario SUNAT.' }, 409)
      return json({ error: 'intifact_not_configured' }, 503)
    }
    const result = await emitIntifact(admin, invoice as JsonObject, items as JsonObject[], company as JsonObject, apiKey)
    return json(result.body, result.status)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'emission_failed'
    await admin.from('invoices').update({ status: 'unknown', provider_status: 'ERROR', last_error: message, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() }).eq('id', invoiceId)
    return json({ ok: false, error: message, provider }, 502)
  }
})
