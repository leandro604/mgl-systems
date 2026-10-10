import type { LocalDocument } from '@/lib/db/schema'

export type DocumentFilters = { query: string; project: string; stage: string; type: string; author: string; from: string; to: string }
export const emptyDocumentFilters: DocumentFilters = { query: '', project: '', stage: '', type: '', author: '', from: '', to: '' }
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}
export function documentType(mime: string): string {
  if (mime === 'application/pdf') return 'PDF'
  if (/spreadsheet|excel|csv/.test(mime)) return 'Excel'
  if (/word|document|text\/plain/.test(mime)) return 'Texto'
  if (mime.startsWith('image/')) return 'Imagen'
  return 'Otro'
}
export function filterDocuments(rows: LocalDocument[], filters: DocumentFilters, authors: Record<string, string> = {}): LocalDocument[] {
  const words = normalizeSearch(filters.query).trim().split(/\s+/).filter(Boolean)
  return rows.filter((row) => {
    const date = new Date(row.created_at)
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const text = normalizeSearch([row.name, row.description, row.folder_path, authors[row.uploaded_by] ?? ''].join(' '))
    return !row.deleted_at && (!filters.project || row.project_id === filters.project)
      && (!filters.stage || row.stage_id === filters.stage)
      && (!filters.type || documentType(row.mime_type) === filters.type)
      && (!filters.author || row.uploaded_by === filters.author)
      && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
      && words.every((word) => text.includes(word))
  }).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name, 'es'))
}
export type DocumentFolder = { name: string; path: string; folders: DocumentFolder[]; documents: LocalDocument[] }
export function buildDocumentTree(rows: LocalDocument[]): DocumentFolder {
  const root: DocumentFolder = { name: 'Documentos', path: '/', folders: [], documents: [] }
  for (const row of rows) {
    let node = root
    for (const segment of (row.folder_path || '/').split('/').filter(Boolean)) {
      let child = node.folders.find((folder) => folder.name === segment)
      if (!child) {
        child = { name: segment, path: `${node.path === '/' ? '' : node.path}/${segment}`, folders: [], documents: [] }
        node.folders.push(child)
        node.folders.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
      }
      node = child
    }
    node.documents.push(row)
  }
  return root
}
