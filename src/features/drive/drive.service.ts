import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { decryptToken, encryptToken } from './crypto'
import type { CloudAccountSummary, DriveItem, DriveProvider, WatchRegistration } from './types'

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type CloudAccountRow = Database['public']['Tables']['cloud_accounts']['Row']

export type DriveAccess = {
  cloudAccountId?: string
  admin?: boolean
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function fetchWithRetry(input: string | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(input, init)
      if (response.status !== 429 && response.status < 500) return response
      if (attempt === 2) return response
      const retryAfter = Number(response.headers.get('retry-after'))
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 5
        ? retryAfter * 1000
        : 250 * (attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    } catch (error) {
      lastError = error
      if (attempt === 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Drive request failed')
}

function adminClient(): SupabaseClient<Database> {
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) for Drive webhook processing')
  return createSupabaseAdminClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function refreshGoogle(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: required('GOOGLE_DRIVE_CLIENT_ID'),
    client_secret: required('GOOGLE_DRIVE_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  const data = await response.json() as TokenResponse
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? data.error ?? 'Google token refresh failed')
  return data
}

async function refreshMicrosoft(refreshToken: string): Promise<TokenResponse> {
  const tenant = process.env.MICROSOFT_DRIVE_TENANT_ID || 'common'
  const body = new URLSearchParams({
    client_id: required('MICROSOFT_DRIVE_CLIENT_ID'),
    client_secret: required('MICROSOFT_DRIVE_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'offline_access Files.ReadWrite User.Read',
  })
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  const data = await response.json() as TokenResponse
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? data.error ?? 'Microsoft token refresh failed')
  return data
}

async function currentCloudAccount(provider: DriveProvider, cloudAccountId?: string): Promise<{ account: CloudAccountRow; supabase: SupabaseClient<Database> }> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = typeof claims?.claims?.sub === 'string' ? claims.claims.sub : null
  if (!userId) throw new Error('Authentication required')

  let query = supabase
    .from('cloud_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .is('deleted_at', null)
  if (cloudAccountId) query = query.eq('id', cloudAccountId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`${provider} is not connected for this user`)
  return { account: data, supabase }
}

async function cloudAccountForAdmin(provider: DriveProvider, cloudAccountId: string): Promise<{ account: CloudAccountRow; supabase: SupabaseClient<Database> }> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('cloud_accounts')
    .select('*')
    .eq('id', cloudAccountId)
    .eq('provider', provider)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Cloud account unavailable')
  return { account: data, supabase }
}

async function resolveCloudAccount(provider: DriveProvider, access?: DriveAccess) {
  if (access?.admin) {
    if (!access.cloudAccountId) throw new Error('cloudAccountId is required for admin Drive access')
    return cloudAccountForAdmin(provider, access.cloudAccountId)
  }
  return currentCloudAccount(provider, access?.cloudAccountId)
}

async function accessToken(provider: DriveProvider, access?: DriveAccess): Promise<string> {
  const { account, supabase } = await resolveCloudAccount(provider, access)
  const refreshToken = decryptToken(account.refresh_token_enc)
  const refreshed = provider === 'google' ? await refreshGoogle(refreshToken) : await refreshMicrosoft(refreshToken)
  if (!refreshed.access_token) throw new Error(`${provider} token refresh failed`)

  const patch: Database['public']['Tables']['cloud_accounts']['Update'] = {
    last_token_refresh_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    mutation_id: crypto.randomUUID(),
  }
  if (refreshed.refresh_token && refreshed.refresh_token !== refreshToken) patch.refresh_token_enc = encryptToken(refreshed.refresh_token)
  const { error } = await supabase.from('cloud_accounts').update(patch).eq('id', account.id)
  if (error) throw error
  return refreshed.access_token
}

function googleItem(row: { id: string; name?: string | undefined; mimeType?: string | undefined; size?: string | undefined; webViewLink?: string | undefined; parents?: string[] | undefined }): DriveItem {
  return {
    id: row.id,
    name: row.name ?? '',
    isFolder: row.mimeType === 'application/vnd.google-apps.folder',
    mimeType: row.mimeType ?? 'application/octet-stream',
    size: Number(row.size ?? 0),
    webUrl: row.webViewLink ?? '',
    parentId: row.parents?.[0] ?? null,
  }
}

function microsoftItem(row: { id: string; name?: string | undefined; folder?: unknown; file?: { mimeType?: string | undefined } | undefined; size?: number | undefined; webUrl?: string | undefined; parentReference?: { id?: string | undefined } | undefined }): DriveItem {
  return {
    id: row.id,
    name: row.name ?? '',
    isFolder: Boolean(row.folder),
    mimeType: row.folder ? 'application/vnd.microsoft.folder' : row.file?.mimeType ?? 'application/octet-stream',
    size: Number(row.size ?? 0),
    webUrl: row.webUrl ?? '',
    parentId: row.parentReference?.id ?? null,
  }
}

export async function getConnectedCloudAccount(provider: DriveProvider): Promise<CloudAccountSummary | null> {
  try {
    const { account } = await currentCloudAccount(provider)
    return {
      id: account.id,
      provider,
      providerAccountId: account.provider_account_id,
      email: account.account_email,
      name: account.account_name,
      avatarUrl: account.avatar_url,
      connectedAt: account.connected_at,
    }
  } catch {
    return null
  }
}

export async function listDriveItems(provider: DriveProvider, parentId = 'root', access?: DriveAccess): Promise<DriveItem[]> {
  const token = await accessToken(provider, access)
  if (provider === 'google') {
    const rows: DriveItem[] = []
    let pageToken: string | null = null
    do {
      const params = new URLSearchParams({
        q: `'${parentId.replaceAll("'", "\\'")}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,webViewLink,parents)',
        pageSize: '1000',
        orderBy: 'folder,name_natural',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const response = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await response.json() as {
        nextPageToken?: string | undefined
        files?: Array<{ id: string; name?: string | undefined; mimeType?: string | undefined; size?: string | undefined; webViewLink?: string | undefined; parents?: string[] | undefined }> | undefined
        error?: { message?: string | undefined } | undefined
      }
      if (!response.ok) throw new Error(data.error?.message ?? 'Google Drive list failed')
      rows.push(...(data.files ?? []).map(googleItem))
      pageToken = data.nextPageToken ?? null
    } while (pageToken)
    return rows
  }

  const location = parentId === 'root' ? 'root' : `items/${encodeURIComponent(parentId)}`
  let nextUrl: string | null = `https://graph.microsoft.com/v1.0/me/drive/${location}/children?$select=id,name,folder,file,size,webUrl,parentReference&$top=999`
  const rows: DriveItem[] = []
  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await response.json() as {
      value?: Array<{ id: string; name?: string | undefined; folder?: unknown; file?: { mimeType?: string | undefined } | undefined; size?: number | undefined; webUrl?: string | undefined; parentReference?: { id?: string | undefined } | undefined }> | undefined
      '@odata.nextLink'?: string | undefined
      error?: { message?: string | undefined } | undefined
    }
    if (!response.ok) throw new Error(data.error?.message ?? 'OneDrive list failed')
    rows.push(...(data.value ?? []).map(microsoftItem))
    nextUrl = data['@odata.nextLink'] ?? null
  }
  return rows
}

export async function listFolders(provider: DriveProvider, parentId = 'root', access?: DriveAccess): Promise<DriveItem[]> {
  return listDriveItems(provider, parentId, access)
}

export async function getDriveItem(provider: DriveProvider, itemId = 'root', access?: DriveAccess): Promise<DriveItem> {
  const token = await accessToken(provider, access)
  if (provider === 'google') {
    const fields = 'id,name,mimeType,size,webViewLink,parents'
    const response = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(itemId)}?fields=${encodeURIComponent(fields)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; parents?: string[]; error?: { message?: string } }
    if (!response.ok || !data.id) throw new Error(data.error?.message ?? 'Google Drive item lookup failed')
    return googleItem(data as { id: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; parents?: string[] })
  }

  const location = itemId === 'root' ? 'root' : `items/${encodeURIComponent(itemId)}`
  const response = await fetchWithRetry(`https://graph.microsoft.com/v1.0/me/drive/${location}?$select=id,name,folder,file,size,webUrl,parentReference`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await response.json() as { id?: string; name?: string; folder?: unknown; file?: { mimeType?: string }; size?: number; webUrl?: string; parentReference?: { id?: string }; error?: { message?: string } }
  if (!response.ok || !data.id) throw new Error(data.error?.message ?? 'OneDrive item lookup failed')
  return microsoftItem(data as { id: string; name?: string; folder?: unknown; file?: { mimeType?: string }; size?: number; webUrl?: string; parentReference?: { id?: string } })
}

export async function createFolder(provider: DriveProvider, name: string, parentId: string, access?: DriveAccess): Promise<DriveItem> {
  const token = await accessToken(provider, access)
  if (provider === 'google') {
    const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    })
    const data = await response.json() as { id?: string; name?: string; mimeType?: string; webViewLink?: string; parents?: string[]; error?: { message?: string } }
    if (!response.ok || !data.id) throw new Error(data.error?.message ?? 'Google Drive folder creation failed')
    return googleItem(data as { id: string; name?: string; mimeType?: string; webViewLink?: string; parents?: string[] })
  }

  const location = parentId === 'root' ? 'root/children' : `items/${encodeURIComponent(parentId)}/children`
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/${location}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
  })
  const data = await response.json() as { id?: string; name?: string; folder?: unknown; webUrl?: string; parentReference?: { id?: string }; error?: { message?: string } }
  if (!response.ok || !data.id) throw new Error(data.error?.message ?? 'OneDrive folder creation failed')
  return microsoftItem({ id: data.id, name: data.name, folder: data.folder ?? {}, webUrl: data.webUrl, parentReference: data.parentReference })
}

export async function createUploadSession(provider: DriveProvider, input: { parentId: string; fileName: string; mimeType: string; sizeBytes: number }, access?: DriveAccess): Promise<{ uploadUrl: string; expiresAt: string | null }> {
  const token = await accessToken(provider, access)
  if (provider === 'google') {
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,parents', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': input.mimeType,
        'x-upload-content-length': String(input.sizeBytes),
      },
      body: JSON.stringify({ name: input.fileName, parents: [input.parentId] }),
    })
    if (!response.ok) throw new Error(`Google upload session failed (${response.status})`)
    const uploadUrl = response.headers.get('location')
    if (!uploadUrl) throw new Error('Google upload session URL missing')
    return { uploadUrl, expiresAt: null }
  }

  const pathName = encodeURIComponent(input.fileName).replace(/%2F/gi, '/')
  const location = input.parentId === 'root' ? 'root' : `items/${encodeURIComponent(input.parentId)}`
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/${location}:/${pathName}:/createUploadSession`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename', name: input.fileName } }),
  })
  const data = await response.json() as { uploadUrl?: string; expirationDateTime?: string; error?: { message?: string } }
  if (!response.ok || !data.uploadUrl) throw new Error(data.error?.message ?? 'OneDrive upload session failed')
  return { uploadUrl: data.uploadUrl, expiresAt: data.expirationDateTime ?? null }
}

export async function uploadFile(provider: DriveProvider, input: { parentId: string; fileName: string; mimeType: string; sizeBytes: number }, access?: DriveAccess) {
  return createUploadSession(provider, input, access)
}


export async function ensureDriveFolder(provider: DriveProvider, name: string, parentId = 'root', access?: DriveAccess): Promise<DriveItem> {
  const existing = (await listDriveItems(provider, parentId, access)).find((item) => item.isFolder && item.name === name)
  if (existing) return existing
  return createFolder(provider, name, parentId, access)
}

export async function uploadDriveBytes(
  provider: DriveProvider,
  input: { parentId: string; fileName: string; mimeType: string; bytes: Uint8Array },
  access?: DriveAccess,
): Promise<DriveItem> {
  const bytes = Uint8Array.from(input.bytes)
  const existing = (await listDriveItems(provider, input.parentId, access)).find((item) => !item.isFolder && item.name === input.fileName)
  const token = await accessToken(provider, access)

  if (provider === 'google') {
    if (existing) {
      const response = await fetchWithRetry(
        `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media&fields=id,name,mimeType,size,webViewLink,parents`,
        {
          method: 'PATCH',
          headers: { authorization: `Bearer ${token}`, 'content-type': input.mimeType },
          body: bytes.buffer,
        },
      )
      const data = await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; parents?: string[]; error?: { message?: string } }
      if (!response.ok || !data.id) throw new Error(data.error?.message ?? `Google Drive upload failed (${response.status})`)
      return googleItem(data as { id: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; parents?: string[] })
    }

    const sessionResponse = await fetchWithRetry('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,parents', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': input.mimeType,
        'x-upload-content-length': String(bytes.byteLength),
      },
      body: JSON.stringify({ name: input.fileName, parents: [input.parentId] }),
    })
    if (!sessionResponse.ok) throw new Error(`Google upload session failed (${sessionResponse.status})`)
    const uploadUrl = sessionResponse.headers.get('location')
    if (!uploadUrl) throw new Error('Google upload session URL missing')
    const response = await fetchWithRetry(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': input.mimeType, 'content-length': String(bytes.byteLength) },
      body: bytes.buffer,
    })
    const data = await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; parents?: string[]; error?: { message?: string } }
    if (!response.ok || !data.id) throw new Error(data.error?.message ?? `Google Drive upload failed (${response.status})`)
    return googleItem(data as { id: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; parents?: string[] })
  }

  const pathName = encodeURIComponent(input.fileName).replace(/%2F/gi, '/')
  const location = input.parentId === 'root' ? 'root' : `items/${encodeURIComponent(input.parentId)}`
  const response = await fetchWithRetry(`https://graph.microsoft.com/v1.0/me/drive/${location}:/${pathName}:/content`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': input.mimeType },
    body: bytes.buffer,
  })
  const data = await response.json() as { id?: string; name?: string; folder?: unknown; file?: { mimeType?: string }; size?: number; webUrl?: string; parentReference?: { id?: string }; error?: { message?: string } }
  if (!response.ok || !data.id) throw new Error(data.error?.message ?? `OneDrive upload failed (${response.status})`)
  return microsoftItem(data as { id: string; name?: string; folder?: unknown; file?: { mimeType?: string }; size?: number; webUrl?: string; parentReference?: { id?: string } })
}

export async function downloadDriveFile(
  provider: DriveProvider,
  fileId: string,
  access?: DriveAccess,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const token = await accessToken(provider, access)
  const url = provider === 'google'
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}/content`
  const response = await fetchWithRetry(url, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `${provider} download failed (${response.status})`)
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  }
}

export async function watchFolder(provider: DriveProvider, folderId: string, notificationUrl: string, input: { cloudAccountId: string; channelToken: string }): Promise<WatchRegistration> {
  const token = await accessToken(provider, { cloudAccountId: input.cloudAccountId })
  if (provider === 'google') {
    const tokenResponse = await fetchWithRetry('https://www.googleapis.com/drive/v3/changes/startPageToken', {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const tokenData = await tokenResponse.json() as { startPageToken?: string; error?: { message?: string } }
    if (!tokenResponse.ok || !tokenData.startPageToken) throw new Error(tokenData.error?.message ?? 'Google start page token failed')

    const channelId = crypto.randomUUID()
    const expirationMs = Date.now() + 6 * 24 * 60 * 60 * 1000
    const params = new URLSearchParams({ pageToken: tokenData.startPageToken })
    const response = await fetch(`https://www.googleapis.com/drive/v3/changes/watch?${params}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id: channelId, type: 'web_hook', address: notificationUrl, token: input.channelToken, expiration: String(expirationMs) }),
    })
    const data = await response.json() as { id?: string; resourceId?: string; expiration?: string; error?: { message?: string } }
    if (!response.ok) throw new Error(data.error?.message ?? `Google watch failed (${response.status})`)
    return {
      channelId: data.id ?? channelId,
      resourceId: data.resourceId ?? null,
      expiresAt: data.expiration ? new Date(Number(data.expiration)).toISOString() : new Date(expirationMs).toISOString(),
      cursor: tokenData.startPageToken,
    }
  }

  const meResponse = await fetchWithRetry('https://graph.microsoft.com/v1.0/me?$select=id', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  const me = await meResponse.json() as { id?: string; error?: { message?: string } }
  if (!meResponse.ok || !me.id) throw new Error(me.error?.message ?? 'Microsoft user lookup failed')

  // OneDrive for work/school only allows hierarchy notifications at the root.
  // We intentionally subscribe to the root for both account types and rescan only the linked MGL folder.
  const expirationDateTime = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString()
  const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      changeType: 'updated',
      notificationUrl,
      resource: `/users/${me.id}/drive/root`,
      expirationDateTime,
      clientState: input.channelToken,
    }),
  })
  const data = await response.json() as { id?: string; resource?: string; expirationDateTime?: string; error?: { message?: string } }
  if (!response.ok || !data.id) throw new Error(data.error?.message ?? `Microsoft watch failed (${response.status})`)
  return {
    channelId: data.id,
    resourceId: data.resource ?? null,
    expiresAt: data.expirationDateTime ?? expirationDateTime,
    cursor: null,
  }
}

export async function stopWatch(provider: DriveProvider, input: { cloudAccountId: string; channelId: string; resourceId: string | null }): Promise<void> {
  const token = await accessToken(provider, { cloudAccountId: input.cloudAccountId })
  if (provider === 'google') {
    if (!input.resourceId) return
    await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id: input.channelId, resourceId: input.resourceId }),
    }).catch(() => undefined)
    return
  }
  await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(input.channelId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  }).catch(() => undefined)
}

export async function revokeProviderConnection(provider: DriveProvider, cloudAccountId: string): Promise<void> {
  const { account, supabase } = await currentCloudAccount(provider, cloudAccountId)
  const refreshToken = decryptToken(account.refresh_token_enc)
  if (provider === 'google') {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      cache: 'no-store',
    }).catch(() => undefined)
  }
  const { error } = await supabase.from('cloud_accounts').delete().eq('id', cloudAccountId)
  if (error) throw error
}

export function getDriveAdminClient() {
  return adminClient()
}
