'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronDown, FolderKanban } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import styles from './project-switcher.module.css'
import { cn } from '@/lib/utils'

type Project = { id: string; code: string; name: string }

export function ProjectSwitcher({
  projects,
  mobile = false,
  className,
}: {
  projects: Project[]
  mobile?: boolean
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const current = projects.find((project) => pathname.includes(project.id))?.id ?? ''
  const selected = projects.find((project) => project.id === current)
  const popoverId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  function positionPanel() {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect || !panel.current) return
    const width = Math.min(Math.max(rect.width, 320), 420, window.innerWidth - 24)
    panel.current.style.width = `${width}px`
    panel.current.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`
    panel.current.style.top = `${rect.bottom + 6}px`
    panel.current.style.maxHeight = `${Math.max(80, window.innerHeight - rect.bottom - 18)}px`
  }

  useEffect(() => { panel.current?.hidePopover() }, [pathname])
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', positionPanel)
    window.addEventListener('scroll', positionPanel, true)
    return () => {
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', positionPanel, true)
    }
  }, [open])

  if (projects.length === 0) {
    return (
      <button
        type="button"
        onClick={() => router.push('/app/projects')}
        className={cn(
          'inline-flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30',
          mobile && 'w-full justify-center',
          className,
        )}
      >
        <FolderKanban className="size-4 shrink-0 text-blue-600" strokeWidth={1.5} />
        <span className="truncate">Crear primer proyecto</span>
      </button>
    )
  }

  return (
    <div className={cn('min-w-0', mobile ? 'w-full' : 'w-full max-w-[15rem]', className)}>
      <button ref={trigger} type="button" popoverTarget={popoverId} aria-expanded={open} aria-controls={popoverId}
        aria-label={`Seleccionar proyecto: ${selected?.name ?? 'Todos los proyectos'}`}
        onClick={positionPanel} className={styles.trigger}>
        <FolderKanban size={18} aria-hidden="true" />
        <span className={styles.selection}>
          {selected && <small>{selected.code}</small>}
          <span title={selected?.name}>{selected?.name ?? 'Todos los proyectos'}</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div ref={panel} id={popoverId} popover="auto" className={styles.panel}
        onToggle={(event) => setOpen(event.newState === 'open')}>
        <nav aria-label="Seleccionar proyecto" onKeyDown={(event) => {
          const links = Array.from(event.currentTarget.querySelectorAll('a'))
          const index = links.indexOf(document.activeElement as HTMLAnchorElement)
          let next: number
          if (event.key === 'ArrowDown') next = (index + 1) % links.length
          else if (event.key === 'ArrowUp') next = (index - 1 + links.length) % links.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = links.length - 1
          else return
          event.preventDefault()
          links[next]?.focus()
        }}>
          {[{ id: '', code: '', name: 'Todos los proyectos' }, ...projects].map((project) => (
            <Link key={project.id} href={project.id ? `/app/projects/${project.id}` : '/app'}
              aria-current={current === project.id ? 'page' : undefined}
              className={styles.option} onClick={() => panel.current?.hidePopover()}>
              <span>{project.code && <small>{project.code}</small>}{project.name}</span>
              {current === project.id && <Check size={18} aria-hidden="true" />}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
