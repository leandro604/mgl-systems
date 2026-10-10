import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/features/drive/crypto'

type TokenResult = { access_token?: string; refresh_token?: string; error?: string; error_description?: string }
type GoogleAbout = { user?: { displayName?: string; emailAddress?: string; photoLink?: string; permissionId?: string }; error?: { message?: string } }

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expected = request.cookies.get('mgl_google_oauth_state')?.value
  const target = new URL('/app/configuracion/integraciones', request.url)
  if (!code || !state || !expected || state !== expected) {
    target.searchParams.set('error', 'google_state')
    return NextResponse.redirect(target)
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    target.searchParams.set('error', 'google_config')
    return NextResponse.redirect(target)
  }

  const redirectUri = new URL('/api/oauth/google/callback', request.url).toString()
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    cache: 'no-store',
  })
  const token = await response.json() as TokenResult
  if (!response.ok || !token.refresh_token || !token.access_token) {
    target.searchParams.set('error', token.error ?? 'google_token')
    return NextResponse.redirect(target)
  }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = typeof claims?.claims?.sub === 'string' ? claims.claims.sub : null
  if (!userId) return NextResponse.redirect(new URL('/login', request.url))
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id,full_name')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (profileError || !profile) {
    target.searchParams.set('error', 'google_profile')
    return NextResponse.redirect(target)
  }

  const aboutResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink,permissionId)', {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  })
  const about = await aboutResponse.json().catch(() => ({})) as GoogleAbout
  const now = new Date().toISOString()
  const { error } = await supabase.from('cloud_accounts').upsert({
    company_id: profile.company_id,
    user_id: userId,
    provider: 'google',
    refresh_token_enc: encryptToken(token.refresh_token),
    provider_account_id: about.user?.permissionId ?? null,
    account_email: about.user?.emailAddress ?? null,
    account_name: about.user?.displayName ?? profile.full_name,
    avatar_url: about.user?.photoLink ?? null,
    connected_at: now,
    deleted_at: null,
    updated_at: now,
    mutation_id: crypto.randomUUID(),
  }, { onConflict: 'company_id,user_id,provider' })
  if (error) {
    target.searchParams.set('error', 'google_save')
    return NextResponse.redirect(target)
  }

  const out = NextResponse.redirect(target)
  out.cookies.delete('mgl_google_oauth_state')
  return out
}
