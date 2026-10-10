export type DriveProvider = 'google' | 'microsoft'

export type DriveItem = {
  id: string
  name: string
  isFolder: boolean
  mimeType: string
  size: number
  webUrl: string
  parentId: string | null
}

export type CloudAccountSummary = {
  id: string
  provider: DriveProvider
  providerAccountId: string | null
  email: string | null
  name: string | null
  avatarUrl: string | null
  connectedAt: string
}

export type StageFolderEntry = {
  id: string
  name: string
  path: string
}

export type StageFolderMap = Record<string, StageFolderEntry>

export type ProjectCloudDrive = {
  id: string
  projectId: string
  provider: DriveProvider
  cloudAccountId: string
  providerAccountId: string | null
  rootFolderId: string
  rootFolderName: string
  rootFolderUrl: string
  stageFolderMap: StageFolderMap
  syncEnabled: boolean
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'disconnected'
  lastSyncAt: string | null
  syncError: string | null
  watchExpiresAt: string | null
  createdBy: string
}

export type WatchRegistration = {
  channelId: string
  resourceId: string | null
  expiresAt: string | null
  cursor: string | null
}
