'use client'

import type { DriveItem, DriveProvider } from './types'

const CHUNK_SIZE = 10 * 1024 * 1024

type GoogleUpload = { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; parents?: string[] }
type MicrosoftUpload = { id?: string; name?: string; file?: { mimeType?: string }; size?: number; webUrl?: string; parentReference?: { id?: string } }

export async function uploadFileDirect(provider: DriveProvider, file: File, parentId: string, linkId: string): Promise<DriveItem> {
  const sessionResponse = await fetch('/api/drive/upload-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, linkId, parentId, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size }),
  })
  const session = (await sessionResponse.json()) as { uploadUrl?: string; error?: string }
  if (!sessionResponse.ok || !session.uploadUrl) throw new Error(session.error ?? 'No se pudo iniciar la carga')

  let lastPayload: unknown = {}
  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    const endExclusive = Math.min(start + CHUNK_SIZE, file.size)
    const upload = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'content-range': `bytes ${start}-${endExclusive - 1}/${file.size}`,
      },
      body: file.slice(start, endExclusive),
    })
    const intermediate = provider === 'google' ? upload.status === 308 : upload.status === 202
    if (intermediate) continue
    if (!upload.ok) throw new Error(`Upload failed (${upload.status})`)
    lastPayload = await upload.json().catch(() => ({}))
  }

  if (provider === 'google') {
    const row = lastPayload as GoogleUpload
    if (!row.id) throw new Error('Google Drive no devolvió el ID del archivo')
    return { id: row.id, name: row.name ?? file.name, isFolder: false, mimeType: (row.mimeType ?? file.type) || 'application/octet-stream', size: Number(row.size ?? file.size), webUrl: row.webViewLink ?? '', parentId: row.parents?.[0] ?? parentId }
  }

  const row = lastPayload as MicrosoftUpload
  if (!row.id) throw new Error('OneDrive no devolvió el ID del archivo')
  return { id: row.id, name: row.name ?? file.name, isFolder: false, mimeType: (row.file?.mimeType ?? file.type) || 'application/octet-stream', size: Number(row.size ?? file.size), webUrl: row.webUrl ?? '', parentId: row.parentReference?.id ?? parentId }
}
