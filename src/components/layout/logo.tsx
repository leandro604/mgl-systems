import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({ compact = false, className, priority = false }: { compact?: boolean; className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="MGL Systems · Inicio" className={cn('inline-flex shrink-0 items-center', className)}>
      <Image src="/mgl-systems-logo-horizontal.png" alt="MGL Systems" width={2172} height={724} priority={priority} sizes={compact ? '96px' : '(min-width: 900px) 280px, 220px'} className={cn('h-auto object-contain', compact ? 'w-24' : 'w-[220px] lg:w-[280px]')} />
    </Link>
  )
}
