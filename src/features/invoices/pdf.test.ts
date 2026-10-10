import { describe, expect, it } from 'vitest'
import { generateInvoicePdf, type PrintableInvoice } from './pdf'

const invoice: PrintableInvoice = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  projectName: 'Hospital Celendín',
  documentType: '01',
  series: 'F001',
  number: 42,
  issuedOn: '2026-10-09',
  currency: 'PEN',
  issuerName: 'MGL SYSTEMS SAC',
  issuerRuc: '20123456789',
  issuerAddress: 'Av. Principal 123, Lima',
  customerName: 'CLIENTE DE PRUEBA SAC',
  customerDocumentType: '6',
  customerDocumentNumber: '20987654321',
  customerAddress: 'Jr. Prueba 456',
  status: 'accepted',
  providerStatus: 'ACEPTADO',
  cdrCode: '0',
  emissionProvider: 'sunat_direct',
  sunatDigest: 'n9J4M3u5LkO1pQ2rS6tV8wX0yZabCDefGhijkLMNopQ=',
  items: [{ lineNumber: 1, description: 'Servicio de cableado estructurado', unitCode: 'ZZ', quantity: 1, unitPrice: 100, netAmount: 100, taxAmount: 18 }],
  netAmount: 100,
  taxAmount: 18,
  totalAmount: 118,
}

describe('invoice PDF', () => {
  it('generates a valid PDF payload', async () => {
    const bytes = await generateInvoicePdf(invoice, false)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('supports a pending watermark document', async () => {
    const bytes = await generateInvoicePdf({ ...invoice, status: 'submitted', cdrCode: null }, true)
    expect(bytes.length).toBeGreaterThan(1000)
  })
})
