import { createHmac, timingSafeEqual } from 'node:crypto'

function secret(): string {
  const value = process.env.DRIVE_WEBHOOK_SECRET ?? process.env.DRIVE_TOKEN_ENCRYPTION_KEY
  if (!value) throw new Error('Missing DRIVE_WEBHOOK_SECRET (or DRIVE_TOKEN_ENCRYPTION_KEY fallback)')
  return value
}

export function createDriveWatchToken(linkId: string): string {
  return createHmac('sha256', secret()).update(`mgl-drive:${linkId}`).digest('hex')
}

export function verifyDriveWatchToken(linkId: string, provided: string | null | undefined): boolean {
  if (!provided) return false
  const expected = createDriveWatchToken(linkId)
  if (expected.length !== provided.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}
