import { headers } from 'next/headers'

export async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers()
  const forwardedHost = headerStore.get('x-forwarded-host')
  const host = forwardedHost ?? headerStore.get('host') ?? 'localhost:3000'
  const forwardedProto = headerStore.get('x-forwarded-proto')
  const protocol = forwardedProto ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${protocol}://${host}`
}
