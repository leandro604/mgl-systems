import { z } from 'zod'

export type FiscalBankAccount = {
  bank: string
  accountType: string
  currency: 'PEN' | 'USD'
  accountNumber: string
  cci: string
  holder: string
}

export type FiscalDigitalWallet = {
  provider: string
  phone: string
  holder: string
}

const phoneSchema = z.string().trim().min(6, 'Cada teléfono debe tener al menos 6 caracteres.').max(30)
const emailSchema = z.string().trim().email('Ingresa un correo válido.').max(180)

export const bankAccountSchema = z.object({
  bank: z.string().trim().min(2, 'Indica el banco.').max(100),
  accountType: z.string().trim().min(2, 'Indica el tipo de cuenta.').max(80),
  currency: z.enum(['PEN', 'USD']),
  accountNumber: z.string().trim().min(4, 'Indica el número de cuenta.').max(50),
  cci: z.string().trim().max(30).default(''),
  holder: z.string().trim().max(180).default(''),
})

export const digitalWalletSchema = z.object({
  provider: z.string().trim().min(2, 'Indica la billetera digital.').max(80),
  phone: z.string().trim().min(6, 'Indica el teléfono asociado.').max(30),
  holder: z.string().trim().max(180).default(''),
})

export const phonesSchema = z.array(phoneSchema).max(5, 'Puedes registrar hasta 5 teléfonos.')
export const emailsSchema = z.array(emailSchema).max(5, 'Puedes registrar hasta 5 correos.')
export const bankAccountsSchema = z.array(bankAccountSchema).max(5, 'Puedes registrar hasta 5 cuentas bancarias.')
export const digitalWalletsSchema = z.array(digitalWalletSchema).max(5, 'Puedes registrar hasta 5 billeteras digitales.')

export function parseJsonArray<T>(value: FormDataEntryValue | null, schema: z.ZodType<T[]>): T[] {
  if (typeof value !== 'string' || !value.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('La configuración adicional tiene un formato inválido.')
  }
  const result = schema.safeParse(parsed)
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Revisa la configuración adicional.')
  return result.data
}

export function normalizeStoredArray<T>(value: unknown, schema: z.ZodType<T[]>): T[] {
  const result = schema.safeParse(value)
  return result.success ? result.data : []
}
