import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/features/auth/server'

export async function GET(request: NextRequest) {
  await requireAuthenticatedUser()
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'GOOGLE_DRIVE_CLIENT_ID missing' }, { status: 503 })
  const state = crypto.randomUUID()
  const redirectUri = new URL('/api/oauth/google/callback', request.url).toString()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/drive')
  url.searchParams.set('state', state)
  const response = NextResponse.redirect(url)
  response.cookies.set('mgl_google_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 600 })
  return response
}
