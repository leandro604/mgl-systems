import { create } from 'zustand'
import type { SyncCycleSummary } from '@/lib/sync/engine'

export type SyncUiStatus = 'idle' | 'offline' | 'syncing' | 'error'

type SyncStore = {
  status: SyncUiStatus
  lastSyncedAt: string | null
  lastError: string | null
  lastSummary: SyncCycleSummary | null
  setStatus: (status: SyncUiStatus) => void
  setSuccess: (summary: SyncCycleSummary) => void
  setError: (message: string) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
  lastSummary: null,
  setStatus: (status) => set({ status }),
  setSuccess: (lastSummary) => set({
    status: 'idle',
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
    lastSummary,
  }),
  setError: (lastError) => set({ status: 'error', lastError }),
}))
