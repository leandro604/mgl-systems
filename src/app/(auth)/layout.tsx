import type { ReactNode } from 'react'
import { AuthVisual } from '@/components/auth/auth-visual'
import { Logo } from '@/components/layout/logo'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <AuthVisual />
      <div className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><Logo /></div>
          {children}
        </div>
      </div>
    </main>
  )
}
