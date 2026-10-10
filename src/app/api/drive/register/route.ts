import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireWorkspaceContext } from '@/features/auth/server'

const schema = z.object({
  linkId: z.string().uuid(),
  projectId: z.string().uuid(),
  stageId: z.string().uuid(),
  folderPath: z.string().min(1).max(2000),
  item: z.object({
    id: z.string().min(1).max(1000),
    name: z.string().min(1).max(300),
    mimeType: z.string().min(1).max(180),
    size: z.number().nonnegative(),
    webUrl: z.string().url().max(4000),
  }),
})

export async function POST(request: NextRequest) {
  const context = await requireWorkspaceContext()
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  if (!context.projects.some((project) => project.id === parsed.data.projectId)) {
    return NextResponse.json({ error: 'project_unavailable' }, { status: 403 })
  }

  const [{ data: stage, error: stageError }, { data: link, error: linkError }] = await Promise.all([
    context.supabase
      .from('project_stages')
      .select('id')
      .eq('id', parsed.data.stageId)
      .eq('project_id', parsed.data.projectId)
      .is('deleted_at', null)
      .maybeSingle(),
    context.supabase
      .from('project_cloud_drives')
      .select('id,provider,provider_account_id,cloud_account_id,created_by')
      .eq('id', parsed.data.linkId)
      .eq('project_id', parsed.data.projectId)
      .eq('created_by', context.userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  if (stageError) return NextResponse.json({ error: stageError.message }, { status: 400 })
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 })
  if (!stage) return NextResponse.json({ error: 'stage_unavailable' }, { status: 400 })
  if (!link) return NextResponse.json({ error: 'drive_link_unavailable' }, { status: 403 })

  const now = new Date().toISOString()
  const provider = link.provider === 'google' ? 'google_drive' : 'onedrive'
  const { data, error } = await context.supabase
    .from('documents')
    .upsert({
      company_id: context.company.id,
      project_id: parsed.data.projectId,
      stage_id: parsed.data.stageId,
      name: parsed.data.item.name,
      description: '',
      folder_path: parsed.data.folderPath,
      provider,
      provider_account_id: link.provider_account_id ?? link.cloud_account_id,
      external_file_id: parsed.data.item.id,
      web_url: parsed.data.item.webUrl,
      mime_type: parsed.data.item.mimeType,
      size_bytes: parsed.data.item.size,
      uploaded_by: context.userId,
      deleted_at: null,
      mutation_id: crypto.randomUUID(),
      updated_at: now,
    }, { onConflict: 'company_id,project_id,provider,provider_account_id,external_file_id' })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, documentId: data.id })
}
