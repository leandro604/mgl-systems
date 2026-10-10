import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireWorkspaceContext } from '@/features/auth/server'
import { getDriveItem, listDriveItems } from '@/features/drive/drive.service'

const querySchema = z.object({
  provider: z.enum(['google', 'microsoft']),
  parentId: z.string().min(1).max(500).default('root'),
})

export async function GET(request: NextRequest) {
  const context = await requireWorkspaceContext()
  const parsed = querySchema.safeParse({
    provider: request.nextUrl.searchParams.get('provider'),
    parentId: request.nextUrl.searchParams.get('parentId') ?? 'root',
  })
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 })

  const { data: account, error: accountError } = await context.supabase
    .from('cloud_accounts')
    .select('id')
    .eq('company_id', context.company.id)
    .eq('user_id', context.userId)
    .eq('provider', parsed.data.provider)
    .is('deleted_at', null)
    .maybeSingle()
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 400 })
  if (!account) return NextResponse.json({ error: 'drive_account_unavailable' }, { status: 403 })

  try {
    const access = { cloudAccountId: account.id }
    const [current, items] = await Promise.all([
      getDriveItem(parsed.data.provider, parsed.data.parentId, access),
      listDriveItems(parsed.data.provider, parsed.data.parentId, access),
    ])
    return NextResponse.json({
      current,
      folders: items.filter((item) => item.isFolder).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'drive_list_failed' }, { status: 400 })
  }
}
