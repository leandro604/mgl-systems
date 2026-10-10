import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { getSupabasePublicEnv } from './env'

function redirectWithSession(request: NextRequest, response: NextResponse, pathname: string, next?: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  if (next) url.searchParams.set('next', next)
  const redirectResponse = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
  for (const key of ['cache-control', 'expires', 'pragma']) {
    const value = response.headers.get(key)
    if (value) redirectResponse.headers.set(key, value)
  }
  return redirectResponse
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, publishableKey } = getSupabasePublicEnv()

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Keep getClaims immediately after client creation so token refresh/cookie state stays coherent.
  const { data } = await supabase.auth.getClaims()
  const authenticated = Boolean(data?.claims?.sub)
  const pathname = request.nextUrl.pathname
  const protectedRoute = pathname === '/onboarding' || pathname === '/join' || pathname === '/reset-password' || pathname.startsWith('/app')
  const guestOnlyRoute = pathname === '/login' || pathname === '/register'

  if (!authenticated && protectedRoute) {
    const next = pathname.startsWith('/app') ? `${pathname}${request.nextUrl.search}` : undefined
    return redirectWithSession(request, response, '/login', next)
  }
  if (authenticated && guestOnlyRoute) return redirectWithSession(request, response, '/')
  return response
}
