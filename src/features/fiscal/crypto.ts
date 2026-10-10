import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function key(): Buffer {
  const raw = process.env.FISCAL_CREDENTIALS_ENCRYPTION_KEY
  if (!raw || raw.length < 24) throw new Error('Missing FISCAL_CREDENTIALS_ENCRYPTION_KEY')
  return createHash('sha256').update(raw, 'utf8').digest()
}

export function encryptFiscalSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptFiscalSecret(value: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split('.')
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted fiscal secret')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8')
}
