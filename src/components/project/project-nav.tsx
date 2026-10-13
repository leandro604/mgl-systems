import Link from 'next/link'
import {
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Table2,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { AppRole } from '@/features/auth/roles'

type Item = { slug: string; label: string; icon: LucideIcon; roles?: readonly AppRole[] }

const items: Item[] = [
  { slug: '', label: 'Resumen', icon: LayoutDashboard },
  { slug: '/tasks', label: 'Tareas', icon: ClipboardCheck },
  { slug: '/documents', label: 'Documentos', icon: FileText },
  { slug: '/sst', label: 'SST', icon: ShieldCheck },
  { slug: '/inventory', label: 'Almacén', icon: Warehouse },
  { slug: '/planning', label: 'Planificación', icon: CalendarRange },
  { slug: '/control', label: 'Control', icon: BarChart3, roles: ['admin', 'pm'] },
  { slug: '/partidas', label: 'Partidas', icon: Table2 },
  { slug: '/purchases', label: 'Compras', icon: ShoppingCart, roles: ['admin', 'pm'] },
  { slug: '/invoices', label: 'Facturación', icon: ReceiptText, roles: ['admin', 'pm'] },
  { slug: '/team', label: 'Equipo', icon: Users },
]

export function ProjectNav({ projectId, role }: { projectId: string; role: AppRole }) {
  const visibleItems = items.filter((item) => !item.roles || item.roles.includes(role))
  return (
    <nav className="mgl-project-nav mgl-hide-scrollbar -mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain border-b border-slate-200 px-3 pb-3 sm:mx-0 sm:px-0" aria-label="Módulos del proyecto">
      {visibleItems.map(({ slug, label, icon: Icon }) => (
        <Link
          key={slug || 'overview'}
          href={`/app/projects/${projectId}${slug}`}
          prefetch
          className="inline-flex min-h-10 shrink-0 snap-start items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <Icon className="size-4" strokeWidth={1.5} />
          {label}
        </Link>
      ))}
    </nav>
  )
}
