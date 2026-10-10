import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUploadSession } from '@/features/drive/drive.service'
import { normalizeStageFolderMap } from '@/features/drive/drive-utils'
import { requireWorkspaceContext } from '@/features/auth/server'

const schema = z.object({
  provider: z.enum(['google','microsoft']),
  linkId: z.string().uuid(),
  parentId: z.string().min(1).max(500),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024 * 1024),
})

export async function POST(request: NextRequest) {
  const context = await requireWorkspaceContext()
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })

  const { data: link, error } = await context.supabase
    .from('project_cloud_drives')
    .select('id,provider,cloud_account_id,root_folder_id,stage_folder_map,created_by')
    .eq('id', parsed.data.linkId)
    .eq('created_by', context.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!link || link.provider !== parsed.data.provider) return NextResponse.json({ error: 'drive_link_unavailable' }, { status: 403 })

  const stageFolderIds = new Set(Object.values(normalizeStageFolderMap(link.stage_folder_map)).map((entry) => entry.id))
  if (parsed.data.parentId !== link.root_folder_id && !stageFolderIds.has(parsed.data.parentId)) {
    return NextResponse.json({ error: 'folder_not_linked_to_project' }, { status: 403 })
  }

  try {
    return NextResponse.json(await createUploadSession(parsed.data.provider, parsed.data, { cloudAccountId: link.cloud_account_id }))
  } catch (uploadError) {
    return NextResponse.json({ error: uploadError instanceof Error ? uploadError.message : 'upload_session_failed' }, { status: 400 })
  }
}
