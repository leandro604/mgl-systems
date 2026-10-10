import type { Json } from '@/lib/supabase/database.types'
import type { StageFolderMap } from './types'

const STAGE_FOLDER = /^([A-Za-z0-9]{1,4})[_\s-]/

export function stageCodeFromFolderName(name: string): string | null {
  return STAGE_FOLDER.exec(name.trim())?.[1]?.toUpperCase() ?? null
}

export function normalizeStageFolderMap(value: Json | null | undefined): StageFolderMap {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  const result: StageFolderMap = {}
  for (const [stageId, raw] of Object.entries(value)) {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') continue
    const id = typeof raw.id === 'string' ? raw.id : null
    const name = typeof raw.name === 'string' ? raw.name : null
    const path = typeof raw.path === 'string' ? raw.path : null
    if (id && name && path) result[stageId] = { id, name, path }
  }
  return result
}
