'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void
  containerClassName?: string
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, containerClassName, onClear, value, defaultValue, onChange, ...props },
  forwardedRef,
) {
  const localRef = React.useRef<HTMLInputElement | null>(null)
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => String(defaultValue ?? ''))
  const controlled = value !== undefined
  const currentValue = controlled ? String(value ?? '') : uncontrolledValue

  function setRefs(node: HTMLInputElement | null) {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!controlled) setUncontrolledValue(event.target.value)
    onChange?.(event)
  }

  function handleClear() {
    if (!controlled) {
      setUncontrolledValue('')
      if (localRef.current) localRef.current.value = ''
    }
    onClear?.()
    localRef.current?.focus()
  }

  return (
    <div className={cn('relative', containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        strokeWidth={1.5}
      />
      <input
        ref={setRefs}
        type="search"
        {...(controlled ? { value } : { defaultValue })}
        onChange={handleChange}
        className={cn(
          'h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition-colors duration-150',
          'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-600/15',
          '[&::-webkit-search-cancel-button]:hidden',
          className,
        )}
        {...props}
      />
      {onClear && currentValue.length > 0 ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
        >
          <X className="size-3.5" strokeWidth={1.5} />
        </button>
      ) : null}
    </div>
  )
})
