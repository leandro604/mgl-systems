'use client'

import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { LoaderCircle } from 'lucide-react'
import { Button } from './button'

export function SubmitButton({ children, pendingLabel = 'Procesando...', ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? <LoaderCircle className="animate-spin" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  )
}
