import { describe, expect, it } from 'vitest'
import { buildGlobalSearchIndex, normalizeGlobalSearch, searchGlobalIndex } from './global-search'

const projects = [
  { id: 'p1', code: 'HOSP-001', name: 'Hospital Celendín' },
  { id: 'p2', code: 'UNI-002', name: 'Universidad Villarreal' },
]

const tasks = [
  { id: 't1', project_id: 'p1', title: 'Certificación de cableado', description: 'Piso 2', status: 'todo', wbs_code: '1.2.3', deleted_at: null, pending_sync: true },
  { id: 't2', project_id: 'p2', title: 'Instalar switches', description: 'Core principal', status: 'done', wbs_code: '', deleted_at: '2026-09-26T00:00:00Z' },
]

const documents = [
  { id: 'd1', project_id: 'p1', name: 'Memoria técnica', description: 'Comunicaciones', folder_path: '/Ingeniería', mime_type: 'application/pdf', deleted_at: null },
]

describe('global search', () => {
  it('normalizes accents, punctuation and case', () => {
    expect(normalizeGlobalSearch('  Planificación / CELENDÍN  ')).toBe('planificacion celendin')
  })

  it('builds deep links and ignores archived rows', () => {
    const index = buildGlobalSearchIndex({ projects, tasks, documents })
    expect(index.some((result) => result.href === '/app/projects/p1/tasks?focus=t1')).toBe(true)
    expect(index.some((result) => result.id === 'task:t2')).toBe(false)
    expect(index.some((result) => result.href === '/app/projects/p1/documents?focus=d1')).toBe(true)
  })

  it('finds content without requiring accents', () => {
    const index = buildGlobalSearchIndex({ projects, tasks, documents })
    const results = searchGlobalIndex(index, 'memoria tecnica')
    expect(results[0]?.id).toBe('document:d1')
  })

  it('matches project code and project context inside tasks', () => {
    const index = buildGlobalSearchIndex({ projects, tasks, documents })
    expect(searchGlobalIndex(index, 'hosp-001')[0]?.id).toBe('project:p1')
    expect(searchGlobalIndex(index, 'cableado celendin').some((result) => result.id === 'task:t1')).toBe(true)
  })
})
