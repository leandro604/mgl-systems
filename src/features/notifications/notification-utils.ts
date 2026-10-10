import type { LocalNotification } from '@/lib/db/schema'

export function notificationKindLabel(kind: string): string {
  if (kind === 'task_assigned') return 'Tarea'
  if (kind.startsWith('material_request')) return 'Materiales'
  if (kind === 'cost_alert') return 'Costos'
  return 'Aviso'
}

export function notificationKindTone(kind: string): 'info' | 'warning' | 'danger' | 'neutral' {
  if (kind === 'cost_alert') return 'danger'
  if (kind.startsWith('material_request')) return 'warning'
  if (kind === 'task_assigned') return 'info'
  return 'neutral'
}

export function notificationActionUrl(row: Pick<LocalNotification, 'action_url'>): string | null {
  const value = row.action_url?.trim()
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export function formatNotificationTime(value: string): string {
  const timestamp = new Date(value).getTime()
  const deltaMs = timestamp - Date.now()
  const abs = Math.abs(deltaMs)
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  if (abs < 60_000) return 'ahora'
  if (abs < 3_600_000) return rtf.format(Math.round(deltaMs / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(deltaMs / 3_600_000), 'hour')
  if (abs < 7 * 86_400_000) return rtf.format(Math.round(deltaMs / 86_400_000), 'day')
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}
