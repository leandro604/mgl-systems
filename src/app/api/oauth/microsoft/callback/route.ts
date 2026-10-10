import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/features/drive/crypto'

type TokenResult = { access_token?: string; refresh_token?: string; error?: string; error_description?: string }
type MicrosoftMe = { id?: string; displayName?: string; mail?: string | null; userPrincipalName?: string; error?: { message?: string } }

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expected = request.cookies.get('mgl_microsoft_oauth_state')?.value
  const target = new URL('/app/configuracion/integraciones', request.url)
  if (!code || !state || !expected || state !== expected) {
    target.searchParams.set('error', 'microsoft_state')
    return NextResponse.redirect(target)
  }

  const clientId = process.env.MICROSOFT_DRIVE_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_DRIVE_CLIENT_SECRET
  const tenant = process.env.MICROSOFT_DRIVE_TENANT_ID || 'common'
  if (!clientId || !clientSecret) {
    target.searchParams.set('error', 'microsoft_config')
    return NextResponse.redirect(target)
  }

  const redirectUri = new URL('/api/oauth/microsoft/callback', request.url).toString()
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'offline_access Files.ReadWrite User.Read',
    }),
    cache: 'no-store',
  })
  const token = await response.json() as TokenResult
  if (!response.ok || !token.refresh_token || !token.access_token) {
    target.searchParams.set('error', token.error ?? 'microsoft_token')
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
    target.searchParams.set('error', 'microsoft_profile')
    return NextResponse.redirect(target)
  }

  const meResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  })
  const me = await meResponse.json().catch(() => ({})) as MicrosoftMe
  const now = new Date().toISOString()
  const { error } = await supabase.from('cloud_accounts').upsert({
    company_id: profile.company_id,
    user_id: userId,
    provider: 'microsoft',
    refresh_token_enc: encryptToken(token.refresh_token),
    provider_account_id: me.id ?? null,
    account_email: me.mail ?? me.userPrincipalName ?? null,
    account_name: me.displayName ?? profile.full_name,
    avatar_url: null,
    connected_at: now,
    deleted_at: null,
    updated_at: now,
    mutation_id: crypto.randomUUID(),
  }, { onConflict: 'company_id,user_id,provider' })
  if (error) {
    target.searchParams.set('error', 'microsoft_save')
    return NextResponse.redirect(target)
  }

  const out = NextResponse.redirect(target)
  out.cookies.delete('mgl_microsoft_oauth_state')
  return out
}
