import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({ compact = false, className, priority = false }: { compact?: boolean; className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="MGL Systems · Inicio" className={cn('inline-flex shrink-0 items-center rounded-xl bg-white', className)}>
      <Image src="/mgl-systems-logo.png" alt="MGL Systems" width={1448} height={1086} priority={priority} sizes={compact ? '56px' : '(min-width: 1024px) 200px, 160px'} className={cn('h-auto rounded-xl object-contain', compact ? 'w-14' : 'w-40 lg:w-[200px]')} />
    </Link>
  )
}
