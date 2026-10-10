import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import QRCode from '@/vendor/qrcode/index.js'


export type PrintableBankAccount = {
  bank: string
  accountType: string
  currency: 'PEN' | 'USD'
  accountNumber: string
  cci?: string | null
  holder?: string | null
}

export type PrintableDigitalWallet = {
  provider: string
  phone: string
  holder?: string | null
}

export type PrintableInvoiceItem = {
  lineNumber: number
  description: string
  unitCode: string
  quantity: number
  unitPrice: number
  netAmount: number | null
  taxAmount: number | null
}

export type PrintableInvoice = {
  id: string
  projectId: string
  projectName?: string | null
  documentType: string
  series: string | null
  number: number | null
  issuedOn: string
  currency: string
  issuerName: string
  issuerRuc: string
  issuerAddress?: string | null
  issuerPhones?: string[]
  issuerEmails?: string[]
  issuerLogoBytes?: Uint8Array | null
  issuerLogoMime?: string | null
  pdfThankYouMessage?: string | null
  pdfAdditionalMessage?: string | null
  bankAccounts?: PrintableBankAccount[]
  digitalWallets?: PrintableDigitalWallet[]
  customerName: string
  customerDocumentType?: string | null
  customerDocumentNumber: string
  customerAddress?: string | null
  status: string
  providerStatus?: string | null
  cdrCode?: string | null
  items: PrintableInvoiceItem[]
  netAmount: number
  taxAmount: number
  totalAmount: number
  intifactDocumentId?: string | null
  emissionProvider?: string | null
  sunatDigest?: string | null
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 42
const TEXT = rgb(0.12, 0.16, 0.23)
const MUTED = rgb(0.38, 0.43, 0.5)
const BORDER = rgb(0.84, 0.86, 0.89)
const SOFT = rgb(0.96, 0.97, 0.98)
const DARK = rgb(0.06, 0.09, 0.14)

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '?').replace(/\s+/g, ' ').trim()
}

function money(value: number, currency: string): string {
  return `${currency === 'USD' ? 'US$' : 'S/'} ${Number(value || 0).toFixed(2)}`
}

function docName(type: string): string {
  return type === '03' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'FACTURA ELECTRÓNICA'
}

function customerDocumentLabel(type?: string | null): string {
  if (type === '6') return 'RUC'
  if (type === '1') return 'DNI'
  return 'Documento'
}

const UNITS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const TEENS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const TENS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const HUNDREDS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function underHundred(value: number): string {
  if (value < 10) return UNITS[value] ?? ''
  if (value < 20) return TEENS[value - 10] ?? ''
  if (value < 30) return value === 20 ? 'VEINTE' : `VEINTI${(UNITS[value - 20] ?? '').toLowerCase()}`.toUpperCase()
  const tens = Math.floor(value / 10)
  const unit = value % 10
  return unit === 0 ? (TENS[tens] ?? '') : `${TENS[tens]} Y ${UNITS[unit]}`
}

function underThousand(value: number): string {
  if (value === 0) return 'CERO'
  if (value === 100) return 'CIEN'
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  return [hundreds ? HUNDREDS[hundreds] : '', rest ? underHundred(rest) : ''].filter(Boolean).join(' ')
}

function integerWords(value: number): string {
  const n = Math.max(0, Math.floor(value))
  if (n < 1000) return underThousand(n)
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    const head = thousands === 1 ? 'MIL' : `${underThousand(thousands).replace(/UNO$/, 'UN')} MIL`
    return [head, rest ? underThousand(rest) : ''].filter(Boolean).join(' ')
  }
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000)
    const rest = n % 1_000_000
    const head = millions === 1 ? 'UN MILLÓN' : `${integerWords(millions).replace(/UNO$/, 'UN')} MILLONES`
    return [head, rest ? integerWords(rest) : ''].filter(Boolean).join(' ')
  }
  return String(n)
}

function amountInWords(value: number, currency: string): string {
  const safe = Math.max(0, Number(value || 0))
  const integer = Math.floor(safe)
  const cents = Math.round((safe - integer) * 100)
  const unit = currency === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES'
  return `${integerWords(integer)} CON ${String(cents).padStart(2, '0')}/100 ${unit}`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = clean(text).split(' ').filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    let chunk = word
    while (font.widthOfTextAtSize(chunk, size) > maxWidth && chunk.length > 1) {
      let cut = chunk.length - 1
      while (cut > 1 && font.widthOfTextAtSize(chunk.slice(0, cut), size) > maxWidth) cut -= 1
      lines.push(chunk.slice(0, cut))
      chunk = chunk.slice(cut)
    }
    current = chunk
  }
  if (current) lines.push(current)
  return lines
}

type PageContext = {
  pdf: PDFDocument
  page: PDFPage
  regular: PDFFont
  bold: PDFFont
  width: number
  height: number
  y: number
  logoImage?: PDFImage | null
}

function drawHeader(ctx: PageContext, invoice: PrintableInvoice, pageNumber: number) {
  const { page, regular, bold, width, height, logoImage } = ctx
  let y = height - MARGIN
  let textX = MARGIN
  const logoBoxWidth = 64
  if (logoImage) {
    const scaled = logoImage.scaleToFit(logoBoxWidth, 52)
    page.drawImage(logoImage, {
      x: MARGIN,
      y: height - MARGIN - scaled.height + 5,
      width: scaled.width,
      height: scaled.height,
    })
    textX = MARGIN + logoBoxWidth + 12
  }

  const issuerMaxWidth = Math.max(130, width - MARGIN - 225 - textX)
  const issuerLines = wrapText(clean(invoice.issuerName) || 'Empresa emisora', bold, 15, issuerMaxWidth).slice(0, 2)
  issuerLines.forEach((line, index) => page.drawText(line, { x: textX, y: y - 2 - index * 17, size: 15, font: bold, color: DARK }))
  y -= issuerLines.length > 1 ? 34 : 18
  page.drawText(`RUC ${clean(invoice.issuerRuc)}`, { x: textX, y, size: 9, font: regular, color: MUTED })
  y -= 13
  const address = clean(invoice.issuerAddress)
  if (address) {
    for (const line of wrapText(address, regular, 8, issuerMaxWidth).slice(0, 2)) {
      page.drawText(line, { x: textX, y, size: 8, font: regular, color: MUTED })
      y -= 11
    }
  }
  const contactParts: string[] = []
  if (invoice.issuerPhones?.length) contactParts.push(`Tel. ${invoice.issuerPhones.slice(0, 2).map(clean).join(' / ')}`)
  if (invoice.issuerEmails?.length) contactParts.push(invoice.issuerEmails.slice(0, 1).map(clean).join(''))
  if (contactParts.length) {
    const contact = contactParts.join(' · ')
    for (const line of wrapText(contact, regular, 7.2, issuerMaxWidth).slice(0, 2)) {
      page.drawText(line, { x: textX, y, size: 7.2, font: regular, color: MUTED })
      y -= 9
    }
  }

  const boxWidth = 214
  const boxHeight = 82
  const boxX = width - MARGIN - boxWidth
  const boxY = height - MARGIN - boxHeight + 7
  page.drawRectangle({ x: boxX, y: boxY, width: boxWidth, height: boxHeight, borderWidth: 1.2, borderColor: DARK })
  const center = (text: string, size: number, font: PDFFont, offset: number) => {
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: boxX + (boxWidth - textWidth) / 2, y: boxY + offset, size, font, color: DARK })
  }
  center(`RUC ${clean(invoice.issuerRuc)}`, 11, bold, 58)
  center(docName(invoice.documentType), 10, bold, 37)
  const identifier = invoice.series && invoice.number !== null
    ? `${invoice.series}-${String(invoice.number).padStart(8, '0')}`
    : 'BORRADOR'
  center(identifier, 13, bold, 14)

  page.drawLine({ start: { x: MARGIN, y: boxY - 14 }, end: { x: width - MARGIN, y: boxY - 14 }, thickness: 0.8, color: BORDER })
  ctx.y = boxY - 31
  if (pageNumber > 1) {
    page.drawText(`Página ${pageNumber}`, { x: width - MARGIN - 45, y: height - 22, size: 7, font: regular, color: MUTED })
  }
}

function drawCustomer(ctx: PageContext, invoice: PrintableInvoice) {
  const { page, regular, bold, width } = ctx
  const labelX = MARGIN
  const valueX = MARGIN + 93
  const maxWidth = width - MARGIN - valueX
  const row = (label: string, value: string) => {
    page.drawText(label, { x: labelX, y: ctx.y, size: 8.5, font: bold, color: MUTED })
    const lines = wrapText(value || '-', regular, 8.8, maxWidth).slice(0, 2)
    lines.forEach((line, index) => page.drawText(line, { x: valueX, y: ctx.y - index * 11, size: 8.8, font: regular, color: TEXT }))
    ctx.y -= Math.max(14, lines.length * 11 + 3)
  }
  row('Cliente', clean(invoice.customerName))
  row(customerDocumentLabel(invoice.customerDocumentType), clean(invoice.customerDocumentNumber))
  if (clean(invoice.customerAddress)) row('Dirección', clean(invoice.customerAddress))
  row('Fecha de emisión', clean(invoice.issuedOn))
  row('Moneda', invoice.currency === 'USD' ? 'Dólares Americanos (USD)' : 'Soles (PEN)')
  if (clean(invoice.projectName)) row('Proyecto', clean(invoice.projectName))
  ctx.y -= 3
}

function drawTableHeader(ctx: PageContext) {
  const { page, bold, width } = ctx
  const y = ctx.y
  page.drawRectangle({ x: MARGIN, y: y - 18, width: width - 2 * MARGIN, height: 22, color: SOFT })
  const cells = [
    ['#', MARGIN + 6], ['Descripción', MARGIN + 31], ['Und.', MARGIN + 290], ['Cant.', MARGIN + 329], ['P. Unit.', MARGIN + 377], ['Importe', width - MARGIN - 68],
  ] as const
  for (const [label, x] of cells) page.drawText(label, { x, y: y - 10, size: 7.5, font: bold, color: TEXT })
  ctx.y -= 25
}

function ensureItemSpace(ctx: PageContext, invoice: PrintableInvoice, pageNumberRef: { value: number }, heightNeeded: number) {
  if (ctx.y - heightNeeded >= 155) return
  drawFooter(ctx, invoice, pageNumberRef.value)
  const page = ctx.pdf.addPage(A4)
  pageNumberRef.value += 1
  ctx.page = page
  ctx.width = page.getWidth()
  ctx.height = page.getHeight()
  drawHeader(ctx, invoice, pageNumberRef.value)
  drawTableHeader(ctx)
}

function drawItem(ctx: PageContext, invoice: PrintableInvoice, item: PrintableInvoiceItem, pageNumberRef: { value: number }) {
  const { regular } = ctx
  const descriptionLines = wrapText(item.description, regular, 7.5, 248).slice(0, 3)
  const rowHeight = Math.max(18, 10 + descriptionLines.length * 10)
  ensureItemSpace(ctx, invoice, pageNumberRef, rowHeight)
  const { page, width } = ctx
  page.drawLine({ start: { x: MARGIN, y: ctx.y + 3 }, end: { x: width - MARGIN, y: ctx.y + 3 }, thickness: 0.4, color: BORDER })
  page.drawText(String(item.lineNumber), { x: MARGIN + 6, y: ctx.y - 8, size: 7.5, font: regular, color: TEXT })
  descriptionLines.forEach((line, index) => page.drawText(line, { x: MARGIN + 31, y: ctx.y - 8 - index * 10, size: 7.5, font: regular, color: TEXT }))
  page.drawText(clean(item.unitCode || 'NIU'), { x: MARGIN + 290, y: ctx.y - 8, size: 7.2, font: regular, color: TEXT })
  page.drawText(Number(item.quantity).toFixed(2), { x: MARGIN + 329, y: ctx.y - 8, size: 7.2, font: regular, color: TEXT })
  page.drawText(Number(item.unitPrice).toFixed(2), { x: MARGIN + 377, y: ctx.y - 8, size: 7.2, font: regular, color: TEXT })
  const net = Number(item.netAmount ?? item.quantity * item.unitPrice)
  const amount = net.toFixed(2)
  page.drawText(amount, { x: width - MARGIN - 8 - regular.widthOfTextAtSize(amount, 7.2), y: ctx.y - 8, size: 7.2, font: regular, color: TEXT })
  ctx.y -= rowHeight
}

function drawTotals(ctx: PageContext, invoice: PrintableInvoice) {
  const { page, regular, bold, width } = ctx
  ctx.y -= 6
  const left = width - MARGIN - 190
  const right = width - MARGIN
  const row = (label: string, value: string, strong = false) => {
    page.drawText(label, { x: left, y: ctx.y, size: strong ? 9.5 : 8.5, font: strong ? bold : regular, color: strong ? DARK : MUTED })
    const font = strong ? bold : regular
    const size = strong ? 10.5 : 8.5
    page.drawText(value, { x: right - font.widthOfTextAtSize(value, size), y: ctx.y, size, font, color: DARK })
    ctx.y -= strong ? 18 : 15
  }
  row('Op. gravadas', money(invoice.netAmount, invoice.currency))
  row('IGV (18%)', money(invoice.taxAmount, invoice.currency))
  page.drawLine({ start: { x: left, y: ctx.y + 7 }, end: { x: right, y: ctx.y + 7 }, thickness: 0.8, color: BORDER })
  row('TOTAL', money(invoice.totalAmount, invoice.currency), true)
  ctx.y -= 5
  const words = `SON: ${amountInWords(invoice.totalAmount, invoice.currency)}`
  const lines = wrapText(words, bold, 7.7, width - 2 * MARGIN)
  lines.forEach((line) => {
    page.drawText(line, { x: MARGIN, y: ctx.y, size: 7.7, font: bold, color: TEXT })
    ctx.y -= 11
  })
}

function drawStatus(ctx: PageContext, invoice: PrintableInvoice, pending: boolean) {
  const { page, regular, bold } = ctx
  const accepted = invoice.status === 'accepted' || invoice.cdrCode === '0'
  if (accepted) {
    page.drawRectangle({ x: MARGIN, y: ctx.y - 27, width: 215, height: 34, color: rgb(0.93, 0.98, 0.95), borderWidth: 0.7, borderColor: rgb(0.55, 0.78, 0.62) })
    page.drawText('ACEPTADO POR SUNAT', { x: MARGIN + 11, y: ctx.y - 9, size: 9, font: bold, color: rgb(0.1, 0.45, 0.22) })
    page.drawText(`CDR: ${clean(invoice.cdrCode) || '0'}`, { x: MARGIN + 11, y: ctx.y - 21, size: 7.5, font: regular, color: rgb(0.1, 0.45, 0.22) })
    ctx.y -= 42
  } else if (pending || ['queued', 'processing', 'submitted', 'unknown'].includes(invoice.status)) {
    page.drawRectangle({ x: MARGIN, y: ctx.y - 25, width: 215, height: 32, color: rgb(1, 0.98, 0.91), borderWidth: 0.7, borderColor: rgb(0.9, 0.72, 0.35) })
    page.drawText('PENDIENTE DE RESPUESTA SUNAT', { x: MARGIN + 11, y: ctx.y - 12, size: 8.4, font: bold, color: rgb(0.55, 0.34, 0.05) })
    ctx.y -= 40
  }
  const provider = clean(invoice.emissionProvider ?? invoice.providerStatus)
  if (provider) {
    page.drawText(`Canal de emisión: ${provider}`, { x: MARGIN, y: ctx.y, size: 7.2, font: regular, color: MUTED })
    ctx.y -= 11
  }
}


function drawCommercialDetails(ctx: PageContext, invoice: PrintableInvoice) {
  const { page, regular, bold, width } = ctx
  const thankYou = clean(invoice.pdfThankYouMessage)
  const additional = clean(invoice.pdfAdditionalMessage)
  const bankAccounts = (invoice.bankAccounts ?? []).filter((item) => clean(item.bank) && clean(item.accountNumber))
  const wallets = (invoice.digitalWallets ?? []).filter((item) => clean(item.provider) && clean(item.phone))
  if (!thankYou && !additional && bankAccounts.length === 0 && wallets.length === 0) return

  ctx.y -= 3
  if (thankYou) {
    const lines = wrapText(thankYou, bold, 8.2, width - 2 * MARGIN).slice(0, 2)
    lines.forEach((line) => {
      page.drawText(line, { x: MARGIN, y: ctx.y, size: 8.2, font: bold, color: TEXT })
      ctx.y -= 10
    })
    ctx.y -= 2
  }

  if (additional) {
    const lines = wrapText(additional, regular, 7.2, width - 2 * MARGIN).slice(0, 2)
    lines.forEach((line) => {
      page.drawText(line, { x: MARGIN, y: ctx.y, size: 7.2, font: regular, color: MUTED })
      ctx.y -= 9
    })
    ctx.y -= 4
  }

  if (bankAccounts.length === 0 && wallets.length === 0) return
  page.drawText('INFORMACIÓN DE PAGO', { x: MARGIN, y: ctx.y, size: 7.6, font: bold, color: MUTED })
  ctx.y -= 12

  const columnGap = 18
  const columnWidth = (width - 2 * MARGIN - columnGap) / 2
  const startY = ctx.y
  let leftY = startY
  let rightY = startY

  if (bankAccounts.length) {
    page.drawText('Cuentas bancarias', { x: MARGIN, y: leftY, size: 7.5, font: bold, color: TEXT })
    leftY -= 10
    bankAccounts.slice(0, 2).forEach((account) => {
      const currency = account.currency === 'USD' ? 'USD' : 'PEN'
      const primary = `${clean(account.bank)} · ${clean(account.accountType)} · ${currency}`
      const secondary = `Cuenta: ${clean(account.accountNumber)}${clean(account.cci) ? ` · CCI: ${clean(account.cci)}` : ''}`
      for (const line of wrapText(primary, regular, 6.8, columnWidth).slice(0, 2)) {
        page.drawText(line, { x: MARGIN, y: leftY, size: 6.8, font: regular, color: TEXT })
        leftY -= 8
      }
      for (const line of wrapText(secondary, regular, 6.6, columnWidth).slice(0, 2)) {
        page.drawText(line, { x: MARGIN, y: leftY, size: 6.6, font: regular, color: MUTED })
        leftY -= 8
      }
      if (clean(account.holder)) {
        const holder = `Titular: ${clean(account.holder)}`
        page.drawText(wrapText(holder, regular, 6.4, columnWidth)[0] ?? holder, { x: MARGIN, y: leftY, size: 6.4, font: regular, color: MUTED })
        leftY -= 9
      }
      leftY -= 3
    })
    if (bankAccounts.length > 2) {
      page.drawText(`+ ${bankAccounts.length - 2} cuenta(s) adicional(es)`, { x: MARGIN, y: leftY, size: 6.4, font: regular, color: MUTED })
      leftY -= 8
    }
  }

  if (wallets.length) {
    const rightX = MARGIN + columnWidth + columnGap
    page.drawText('Billeteras digitales', { x: rightX, y: rightY, size: 7.5, font: bold, color: TEXT })
    rightY -= 10
    wallets.slice(0, 2).forEach((wallet) => {
      const primary = `${clean(wallet.provider)} · ${clean(wallet.phone)}`
      page.drawText(wrapText(primary, regular, 6.8, columnWidth)[0] ?? primary, { x: rightX, y: rightY, size: 6.8, font: regular, color: TEXT })
      rightY -= 8
      if (clean(wallet.holder)) {
        const holder = `Titular: ${clean(wallet.holder)}`
        page.drawText(wrapText(holder, regular, 6.4, columnWidth)[0] ?? holder, { x: rightX, y: rightY, size: 6.4, font: regular, color: MUTED })
        rightY -= 9
      }
      rightY -= 3
    })
    if (wallets.length > 2) {
      page.drawText(`+ ${wallets.length - 2} billetera(s) adicional(es)`, { x: rightX, y: rightY, size: 6.4, font: regular, color: MUTED })
      rightY -= 8
    }
  }

  ctx.y = Math.min(leftY, rightY) - 3
}

function sunatQrPayload(invoice: PrintableInvoice): string | null {
  if (!invoice.series || invoice.number === null) return null
  return [
    clean(invoice.issuerRuc),
    clean(invoice.documentType),
    clean(invoice.series),
    String(invoice.number),
    Number(invoice.taxAmount || 0).toFixed(2),
    Number(invoice.totalAmount || 0).toFixed(2),
    clean(invoice.issuedOn),
    clean(invoice.customerDocumentType),
    clean(invoice.customerDocumentNumber),
    clean(invoice.sunatDigest),
  ].join('|')
}

function drawSunatQr(ctx: PageContext, invoice: PrintableInvoice) {
  const payload = sunatQrPayload(invoice)
  if (!payload) return

  // SUNAT: QR Code 2005, corrección de error Q. QRErrorCorrectLevel.Q = 3
  // en la implementación vendorizada de Kazuhiko Arase.
  const qr = new QRCode(-1, 3)
  qr.addData(payload)
  qr.make()

  const count = qr.getModuleCount()
  const quietModules = 4
  const totalModules = count + quietModules * 2
  const maxSize = 128 // < 6 cm en A4; deja margen suficiente para texto auxiliar.
  const moduleSize = Math.max(0.55, Math.min(3.05, maxSize / totalModules))
  const qrSize = moduleSize * totalModules
  const x0 = MARGIN
  const y0 = 82

  ctx.page.drawRectangle({ x: x0, y: y0, width: qrSize, height: qrSize, color: rgb(1, 1, 1) })
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue
      ctx.page.drawRectangle({
        x: x0 + (col + quietModules) * moduleSize,
        y: y0 + (count - 1 - row + quietModules) * moduleSize,
        width: moduleSize + 0.02,
        height: moduleSize + 0.02,
        color: rgb(0, 0, 0),
      })
    }
  }

  const textX = x0 + qrSize + 14
  const textWidth = ctx.width - MARGIN - textX
  ctx.page.drawText('Código QR SUNAT', { x: textX, y: y0 + qrSize - 12, size: 8.5, font: ctx.bold, color: DARK })
  const explanation = invoice.sunatDigest
    ? 'Incluye RUC, tipo, serie, correlativo, IGV, total, fecha, documento del cliente y valor resumen.'
    : 'Incluye los datos tributarios disponibles. El valor resumen se incorporará cuando exista XML firmado.'
  const lines = wrapText(explanation, ctx.regular, 7, textWidth).slice(0, 4)
  lines.forEach((line, index) => {
    ctx.page.drawText(line, { x: textX, y: y0 + qrSize - 26 - index * 9, size: 7, font: ctx.regular, color: MUTED })
  })

  if (invoice.sunatDigest) {
    ctx.page.drawText('Valor resumen:', { x: textX, y: y0 + 28, size: 6.8, font: ctx.bold, color: MUTED })
    const digest = clean(invoice.sunatDigest)
    const digestLines = wrapText(digest, ctx.regular, 6.2, textWidth).slice(0, 3)
    digestLines.forEach((line, index) => {
      ctx.page.drawText(line, { x: textX, y: y0 + 18 - index * 8, size: 6.2, font: ctx.regular, color: MUTED })
    })
  }
}

function drawFooter(ctx: PageContext, invoice: PrintableInvoice, pageNumber: number) {
  const { page, regular, width } = ctx
  page.drawLine({ start: { x: MARGIN, y: 66 }, end: { x: width - MARGIN, y: 66 }, thickness: 0.6, color: BORDER })
  const footer = invoice.status === 'draft'
    ? 'Documento de trabajo. No constituye comprobante electrónico emitido.'
    : 'Representación impresa del comprobante electrónico generado por MGL Systems.'
  page.drawText(footer, { x: MARGIN, y: 49, size: 7, font: regular, color: MUTED })
  const pageLabel = `Página ${pageNumber}`
  page.drawText(pageLabel, { x: width - MARGIN - regular.widthOfTextAtSize(pageLabel, 7), y: 49, size: 7, font: regular, color: MUTED })
}

export async function generateInvoicePdf(invoice: PrintableInvoice, pending = false): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${docName(invoice.documentType)} ${invoice.series ?? ''}-${invoice.number ?? ''}`.trim())
  pdf.setAuthor(clean(invoice.issuerName) || 'MGL Systems')
  pdf.setCreator('MGL Systems')
  pdf.setProducer('MGL Systems · pdf-lib')
  pdf.setCreationDate(new Date())

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let logoImage: PDFImage | null = null
  if (invoice.issuerLogoBytes?.length) {
    try {
      logoImage = invoice.issuerLogoMime === 'image/png'
        ? await pdf.embedPng(invoice.issuerLogoBytes)
        : await pdf.embedJpg(invoice.issuerLogoBytes)
    } catch {
      logoImage = null
    }
  }
  const first = pdf.addPage(A4)
  const ctx: PageContext = { pdf, page: first, regular, bold, width: first.getWidth(), height: first.getHeight(), y: 0, logoImage }
  const pageNumber = { value: 1 }

  drawHeader(ctx, invoice, pageNumber.value)
  drawCustomer(ctx, invoice)
  drawTableHeader(ctx)
  for (const item of invoice.items) drawItem(ctx, invoice, item, pageNumber)

  const hasCommercialDetails = Boolean(clean(invoice.pdfThankYouMessage) || clean(invoice.pdfAdditionalMessage) || invoice.bankAccounts?.length || invoice.digitalWallets?.length)
  const finalSectionMinY = invoice.series && invoice.number !== null
    ? (hasCommercialDetails ? 500 : 390)
    : (hasCommercialDetails ? 390 : 270)
  if (ctx.y < finalSectionMinY) {
    drawFooter(ctx, invoice, pageNumber.value)
    const page = pdf.addPage(A4)
    pageNumber.value += 1
    ctx.page = page
    ctx.width = page.getWidth()
    ctx.height = page.getHeight()
    drawHeader(ctx, invoice, pageNumber.value)
  }

  drawTotals(ctx, invoice)
  drawStatus(ctx, invoice, pending)
  drawCommercialDetails(ctx, invoice)
  drawSunatQr(ctx, invoice)

  if (pending || invoice.status === 'draft') {
    const text = invoice.status === 'draft' ? 'BORRADOR' : 'PENDIENTE DE SUNAT'
    for (const page of pdf.getPages()) {
      const size = text === 'BORRADOR' ? 58 : 38
      const textWidth = bold.widthOfTextAtSize(text, size)
      page.drawText(text, {
        x: Math.max(50, (page.getWidth() - textWidth) / 2 - 20),
        y: page.getHeight() / 2,
        size,
        font: bold,
        color: rgb(0.72, 0.12, 0.12),
        opacity: 0.1,
        rotate: degrees(32),
      })
    }
  }

  pdf.getPages().forEach((page, index) => {
    ctx.page = page
    ctx.width = page.getWidth()
    drawFooter(ctx, invoice, index + 1)
  })

  return pdf.save()
}
