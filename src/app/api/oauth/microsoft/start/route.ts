import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/features/auth/server'
export async function GET(request: NextRequest) {
  await requireAuthenticatedUser()
  const clientId=process.env.MICROSOFT_DRIVE_CLIENT_ID
  if(!clientId)return NextResponse.json({error:'MICROSOFT_DRIVE_CLIENT_ID missing'},{status:503})
  const tenant=process.env.MICROSOFT_DRIVE_TENANT_ID||'common'
  const state=crypto.randomUUID(); const redirectUri=new URL('/api/oauth/microsoft/callback',request.url).toString()
  const url=new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`)
  url.searchParams.set('client_id',clientId);url.searchParams.set('response_type','code');url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('response_mode','query');url.searchParams.set('scope','offline_access Files.ReadWrite User.Read');url.searchParams.set('state',state)
  const response=NextResponse.redirect(url);response.cookies.set('mgl_microsoft_oauth_state',state,{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:600});return response
}
