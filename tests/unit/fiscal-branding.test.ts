import { describe, expect, it } from 'vitest'
import {
  bankAccountsSchema,
  digitalWalletsSchema,
  emailsSchema,
  normalizeStoredArray,
  phonesSchema,
} from '@/features/fiscal/branding'

describe('fiscal branding configuration', () => {
  it('accepts valid issuer contact channels', () => {
    expect(normalizeStoredArray(['+51 999 999 999'], phonesSchema)).toEqual(['+51 999 999 999'])
    expect(normalizeStoredArray(['facturacion@mgl.pe'], emailsSchema)).toEqual(['facturacion@mgl.pe'])
  })

  it('normalizes invalid stored arrays to an empty collection', () => {
    expect(normalizeStoredArray('not-an-array', phonesSchema)).toEqual([])
    expect(normalizeStoredArray([{ bank: 'BCP' }], bankAccountsSchema)).toEqual([])
  })

  it('accepts bank accounts and digital wallets used by the PDF', () => {
    const accounts = [{ bank: 'BCP', accountType: 'Cuenta corriente', currency: 'PEN', accountNumber: '191-123', cci: '00219100000000000001', holder: 'MGL Systems' }]
    const wallets = [{ provider: 'Yape', phone: '999999999', holder: 'MGL Systems' }]
    expect(bankAccountsSchema.parse(accounts)).toHaveLength(1)
    expect(digitalWalletsSchema.parse(wallets)).toHaveLength(1)
  })
})
