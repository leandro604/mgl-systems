import { after, NextRequest, NextResponse } from 'next/server'
import { getDriveAdminClient } from '@/features/drive/drive.service'
import { syncProjectDriveLink } from '@/features/drive/drive-structure-importer'
import { verifyDriveWatchToken } from '@/features/drive/watch-token'
import type { DriveProvider } from '@/features/drive/types'

function providerValue(value: string): DriveProvider | null {
  return value === 'google' || value === 'microsoft' ? value : null
}

async function syncLinks(linkIds: string[]) {
  for (const linkId of [...new Set(linkIds)]) {
    await syncProjectDriveLink(linkId, { admin: true }).catch(() => undefined)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const provider = providerValue((await params).provider)
  if (!provider) return NextResponse.json({ error: 'provider_not_supported' }, { status: 404 })

  if (provider === 'microsoft') {
    const validationToken = request.nextUrl.searchParams.get('validationToken')
    if (validationToken) {
      return new NextResponse(validationToken, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }
  }

  const supabase = getDriveAdminClient()
  if (provider === 'google') {
    const channelId = request.headers.get('x-goog-channel-id')
    const channelToken = request.headers.get('x-goog-channel-token')
    if (!channelId) return NextResponse.json({ error: 'missing_channel' }, { status: 400 })
    const { data: link, error } = await supabase
      .from('project_cloud_drives')
      .select('id')
      .eq('provider', 'google')
      .eq('watch_channel_id', channelId)
      .eq('sync_enabled', true)
      .is('deleted_at', null)
      .maybeSingle()
    if (error || !link) return NextResponse.json({ error: 'watch_not_found' }, { status: 404 })
    if (!verifyDriveWatchToken(link.id, channelToken)) return NextResponse.json({ error: 'invalid_channel_token' }, { status: 403 })
    after(() => syncLinks([link.id]))
    return NextResponse.json({ ok: true }, { status: 202 })
  }

  const body = await request.json().catch(() => null) as { value?: Array<{ subscriptionId?: string; clientState?: string }> } | null
  const notifications = body?.value ?? []
  if (!notifications.length) return NextResponse.json({ ok: true }, { status: 202 })

  const subscriptionIds = notifications.map((item) => item.subscriptionId).filter((value): value is string => Boolean(value))
  if (!subscriptionIds.length) return NextResponse.json({ ok: true }, { status: 202 })
  const { data: links, error } = await supabase
    .from('project_cloud_drives')
    .select('id,watch_channel_id')
    .eq('provider', 'microsoft')
    .eq('sync_enabled', true)
    .in('watch_channel_id', subscriptionIds)
    .is('deleted_at', null)
  if (error) return NextResponse.json({ error: 'watch_lookup_failed' }, { status: 500 })

  const validIds: string[] = []
  for (const link of links ?? []) {
    const notification = notifications.find((item) => item.subscriptionId === link.watch_channel_id)
    if (notification && verifyDriveWatchToken(link.id, notification.clientState)) validIds.push(link.id)
  }
  after(() => syncLinks(validIds))
  return NextResponse.json({ ok: true }, { status: 202 })
}
