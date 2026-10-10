import * as React from 'react'
import { cn } from '@/lib/utils'

export type ProgressTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'critical'

const fillTone: Record<ProgressTone, string> = {
  neutral: 'bg-slate-500',
  info: 'bg-blue-600',
  success: 'bg-green-600',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
  critical: 'bg-red-900',
}

export function clampProgress(value: number, max = 100): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(Math.max((value / max) * 100, 0), 100)
}

export interface ProgressBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number
  max?: number
  tone?: ProgressTone
  label?: string
  showValue?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'info',
  label,
  showValue = false,
  className,
  ...props
}: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100
  const safeValue = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax)
  const percentage = clampProgress(safeValue, safeMax)

  return (
    <div className={cn('space-y-2', className)} {...props}>
      {(label || showValue) ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-medium text-slate-600">{label}</span>
          {showValue ? <span className="tabular-nums text-slate-500">{percentage.toFixed(0)}%</span> : null}
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        {...(label ? { 'aria-label': label } : {})}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-150', fillTone[tone])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
