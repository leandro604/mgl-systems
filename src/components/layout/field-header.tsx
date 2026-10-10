import { LogOut } from 'lucide-react'
import { Logo } from './logo'

export function FieldHeader({ fullName }: { fullName: string }) {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MG'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <Logo compact className="[&>span:first-of-type]:border-slate-200 [&>span:first-of-type]:bg-slate-50 [&>span:first-of-type]:text-blue-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
          <p className="text-[11px] font-medium uppercase tracking-[.12em] text-slate-400">Campo</p>
        </div>
        <div className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">{initials}</div>
        <form action="/auth/signout" method="post">
          <button type="submit" title="Cerrar sesión" aria-label="Cerrar sesión" className="grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <LogOut className="size-4" strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </header>
  )
}

