export function isDriveSchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  if (candidate.code !== 'PGRST205') return false
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  return /cloud_accounts|project_cloud_drives/i.test(message)
}
