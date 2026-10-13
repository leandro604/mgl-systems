'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected?: boolean
  removable?: boolean
  onRemove?: () => void
}

export function Chip({ selected = false, removable = false, onRemove, className, children, ...props }: ChipProps) {
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        aria-pressed={selected}
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30',
          selected
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          removable && 'rounded-r-none pr-2',
          className,
        )}
        {...props}
      >
        {children}
      </button>
      {removable ? (
        <button
          type="button"
          aria-label="Quitar filtro"
          onClick={onRemove}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-r-full border border-l-0 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30',
            selected
              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900',
          )}
        >
          <X className="size-3.5" strokeWidth={1.5} />
        </button>
      ) : null}
    </span>
  )
}
