import Link from 'next/link'
import { Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-3 text-slate-100', className)}>
      <span className="grid size-10 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
        <Boxes className="size-5" />
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-sm font-black tracking-[0.18em]">MGL SYSTEMS</span>
          <span className="block text-[10px] uppercase tracking-[0.22em] text-slate-500">ConTech Workspace</span>
        </span>
      ) : null}
    </Link>
  )
}
