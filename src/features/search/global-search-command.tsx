'use client'

import { liveQuery } from 'dexie'
import {
  ArrowRight,
  ClipboardCheck,
  Command,
  FileText,
  FolderKanban,
  LayoutGrid,
  Search,
  WifiOff,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { getLocalDb } from '@/lib/db/dexie'
import type { LocalDocument, LocalTask } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import {
  buildGlobalSearchIndex,
  searchGlobalIndex,
  type GlobalSearchKind,
  type GlobalSearchResult,
  type SearchProject,
} from './global-search'

type Props = {
  companyId: string
  userId: string
  projects: SearchProject[]
}

type KindMeta = {
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
}

const kindMeta: Record<GlobalSearchKind, KindMeta> = {
  module: { label: 'Módulos', icon: LayoutGrid },
  project: { label: 'Proyectos', icon: FolderKanban },
  task: { label: 'Tareas', icon: ClipboardCheck },
  document: { label: 'Documentos', icon: FileText },
}

const kindOrder: GlobalSearchKind[] = ['module', 'project', 'task', 'document']

export function GlobalSearchCommand({ companyId, userId, projects }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [documents, setDocuments] = useState<LocalDocument[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [localReady, setLocalReady] = useState(false)
  const [online, setOnline] = useState(true)

  const index = useMemo(
    () => buildGlobalSearchIndex({ projects, tasks, documents }),
    [documents, projects, tasks],
  )
  const results = useMemo(() => searchGlobalIndex(index, query), [index, query])
  const grouped = useMemo(
    () => kindOrder
      .map((kind) => ({ kind, rows: results.filter((result) => result.kind === kind) }))
      .filter((group) => group.rows.length > 0),
    [results],
  )
  const resultPosition = useMemo(
    () => new Map(results.map((result, position) => [result.id, position])),
    [results],
  )

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let subscription: { unsubscribe: () => void } | undefined
    const projectIds = projects.map((project) => project.id)

    // RuntimeBoot intentionally closes/reopens the shared Dexie connection on
    // authentication changes. Subscribe in a microtask so its initial reset
    // runs first, then reuse the stable per-user database instance.
    queueMicrotask(() => {
      if (disposed) return
      const db = getLocalDb({ companyId, userId })
      subscription = liveQuery(async () => {
        if (projectIds.length === 0) return { tasks: [] as LocalTask[], documents: [] as LocalDocument[] }
        const [localTasks, localDocuments] = await Promise.all([
          db.tasks.where('project_id').anyOf(projectIds).toArray(),
          db.documents.where('project_id').anyOf(projectIds).toArray(),
        ])
        return {
          tasks: localTasks.filter((task) => !task.deleted_at),
          documents: localDocuments.filter((document) => !document.deleted_at),
        }
      }).subscribe({
        next: (rows) => {
          if (disposed) return
          setTasks(rows.tasks)
          setDocuments(rows.documents)
          setLocalReady(true)
        },
        error: () => {
          if (!disposed) setLocalReady(true)
        },
      })
    })

    return () => {
      disposed = true
      subscription?.unsubscribe()
    }
  }, [companyId, projects, userId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('es') === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = originalOverflow
      previousFocus.current?.focus()
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (activeIndex < results.length) return
    setActiveIndex(Math.max(0, results.length - 1))
  }, [activeIndex, results.length])

  function close() {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  function navigate(result: GlobalSearchResult) {
    close()
    router.push(result.href)
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => results.length ? (current + 1) % results.length : 0)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => results.length ? (current - 1 + results.length) % results.length : 0)
      return
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      navigate(results[activeIndex])
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 min-w-48 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-700 sm:flex lg:min-w-56"
        aria-label="Abrir búsqueda global"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="size-4" strokeWidth={1.5} />
        <span className="min-w-0 flex-1 truncate">Buscar en MGL Systems</span>
        <span className="flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          <Command className="size-2.5" />K
        </span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 sm:hidden"
        aria-label="Abrir búsqueda global"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="size-4" strokeWidth={1.5} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/35 px-3 pt-[10vh] backdrop-blur-[2px] sm:px-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-search-title"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
          >
            <h2 id="global-search-title" className="sr-only">Búsqueda global</h2>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 sm:px-5">
              <Search className="size-5 shrink-0 text-slate-400" strokeWidth={1.5} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
                role="combobox"
                aria-expanded="true"
                aria-controls="global-search-results"
                aria-activedescendant={results[activeIndex] ? `global-search-${results[activeIndex].id.replace(/[^a-zA-Z0-9_-]/g, '-')}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" onClick={close} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-slate-700">
                Esc
              </button>
            </div>

            <div id="global-search-results" className="max-h-[min(62vh,34rem)] overflow-y-auto p-2" role="listbox">
              {results.length ? grouped.map(({ kind, rows }) => {
                const meta = kindMeta[kind]
                const GroupIcon = meta.icon
                return (
                  <div key={kind} className="mb-2 last:mb-0">
                    <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      <GroupIcon className="size-3.5" strokeWidth={1.5} />
                      {meta.label}
                    </div>
                    <div className="space-y-0.5">
                      {rows.map((result) => {
                        const position = resultPosition.get(result.id) ?? 0
                        const selected = position === activeIndex
                        const Icon = kindMeta[result.kind].icon
                        return (
                          <button
                            key={result.id}
                            id={`global-search-${result.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onMouseEnter={() => setActiveIndex(position)}
                            onClick={() => navigate(result)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                              selected ? 'bg-blue-50 text-blue-950' : 'text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            <span className={cn(
                              'grid size-9 shrink-0 place-items-center rounded-lg border',
                              selected ? 'border-blue-100 bg-white text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-500',
                            )}>
                              <Icon className="size-4" strokeWidth={1.5} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">{result.title}</span>
                                {result.pendingSync ? <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">LOCAL</span> : null}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>
                            </span>
                            <ArrowRight className={cn('size-4 shrink-0', selected ? 'text-blue-500' : 'text-slate-300')} strokeWidth={1.5} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              }) : (
                <div className="px-6 py-12 text-center">
                  <Search className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
                  <p className="mt-3 text-sm font-medium text-slate-700">No encontramos coincidencias</p>
                  <p className="mt-1 text-xs text-slate-400">Prueba con otro nombre, código, carpeta o palabra clave.</p>
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[10px] text-slate-400 sm:px-5">
              <span className="flex items-center gap-3">
                <span>↑↓ navegar</span>
                <span>↵ abrir</span>
                <span>Esc cerrar</span>
              </span>
              <span className="flex items-center gap-1.5">
                {!online ? <WifiOff className="size-3.5 text-amber-500" /> : null}
                {localReady ? 'Índice local listo' : 'Cargando índice local…'}
              </span>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  )
}
