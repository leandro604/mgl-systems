'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, CloudOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useSyncStore } from '@/stores/sync-store'

export function SyncStatus() {
  const status = useSyncStore((state) => state.status)
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
  const lastError = useSyncStore((state) => state.lastError)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const resolved = !online ? 'offline' : status
  const meta = resolved === 'syncing'
    ? { icon: LoaderCircle, label: 'Sincronizando', classes: 'text-blue-700 border-blue-200 bg-blue-50', spin: true }
    : resolved === 'offline'
      ? { icon: CloudOff, label: 'Sin conexión', classes: 'text-amber-700 border-amber-200 bg-amber-50', spin: false }
      : resolved === 'error'
        ? { icon: TriangleAlert, label: 'Error de sync', classes: 'text-red-700 border-red-200 bg-red-50', spin: false }
        : { icon: CheckCircle2, label: lastSyncedAt ? 'Sincronizado' : 'Local listo', classes: 'text-green-700 border-green-200 bg-green-50', spin: false }
  const Icon = meta.icon

  return (
    <span
      title={resolved === 'error' && lastError ? lastError : lastSyncedAt ? `Última sincronización: ${new Date(lastSyncedAt).toLocaleString()}` : undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.classes}`}
    >
      <Icon className={`size-3.5 ${meta.spin ? 'animate-spin' : ''}`} strokeWidth={1.5} />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  )
}
