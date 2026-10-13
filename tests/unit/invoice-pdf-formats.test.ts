import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { generateInvoicePdf, normalizeInvoicePdfFormat, type InvoicePdfFormat, type PrintableInvoice } from '@/features/invoices/pdf'

const invoice: PrintableInvoice = {
  id: 'invoice-1',
  projectId: 'project-1',
  projectName: 'Hospital Celendín',
  documentType: '01',
  series: 'F001',
  number: 125,
  issuedOn: '2026-10-11',
  currency: 'PEN',
  issuerName: 'MGL Systems Demo',
  issuerRuc: '20123456789',
  issuerAddress: 'Av. Prueba 123',
  customerName: 'Cliente de prueba',
  customerDocumentType: '6',
  customerDocumentNumber: '20987654321',
  customerAddress: 'Lima',
  status: 'accepted',
  providerStatus: 'ACEPTADO',
  cdrCode: '0',
  items: [
    { lineNumber: 1, description: 'Servicio de instalación de cableado estructurado', unitCode: 'ZZ', quantity: 2, unitPrice: 100, netAmount: 200, taxAmount: 36 },
  ],
  netAmount: 200,
  taxAmount: 36,
  totalAmount: 236,
  emissionProvider: 'sunat_direct',
  sunatDigest: 'TESTDIGEST123',
}

async function firstPage(format: InvoicePdfFormat) {
  const bytes = await generateInvoicePdf(invoice, false, format)
  const pdf = await PDFDocument.load(bytes)
  const [page] = pdf.getPages()
  if (!page) throw new Error(`PDF ${format} was generated without pages`)
  return page
}

describe('invoice PDF formats', () => {
  it('normalizes supported formats and rejects unknown values', () => {
    expect(normalizeInvoicePdfFormat('ticket80')).toBe('ticket80')
    expect(normalizeInvoicePdfFormat('letter', 'a5')).toBe('a5')
  })

  it('renders A4 and A5 with their expected page size', async () => {
    const a4 = await firstPage('a4')
    const a5 = await firstPage('a5')
    expect(Math.round(a4.getWidth())).toBe(595)
    expect(Math.round(a4.getHeight())).toBe(842)
    expect(Math.round(a5.getWidth())).toBe(420)
    expect(Math.round(a5.getHeight())).toBe(595)
  })

  it('renders 80 mm and 58 mm thermal tickets', async () => {
    const ticket80 = await firstPage('ticket80')
    const ticket58 = await firstPage('ticket58')
    expect(Math.round(ticket80.getWidth())).toBe(227)
    expect(Math.round(ticket58.getWidth())).toBe(164)
    expect(ticket80.getHeight()).toBeGreaterThan(400)
    expect(ticket58.getHeight()).toBeGreaterThan(400)
  })
})
