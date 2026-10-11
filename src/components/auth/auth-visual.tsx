'use client'

import { motion } from 'framer-motion'
import { Building2, CloudCog, ShieldCheck, WifiOff } from 'lucide-react'
import { Logo } from '@/components/layout/logo'

const items = [
  { icon: Building2, title: 'Proyectos centralizados' },
  { icon: WifiOff, title: 'Trabajo local-first' },
  { icon: CloudCog, title: 'Sincronización segura' },
  { icon: ShieldCheck, title: 'Permisos por rol' },
]

export function AuthVisual() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden border-r border-slate-800 bg-slate-950 p-10 lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.13),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,.1),transparent_32%)]" />
      <div className="relative z-10"><Logo /></div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 my-auto max-w-xl"
      >
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Gestión de obra conectada</span>
        <h1 className="mt-5 text-5xl font-black leading-[1.04] tracking-tight text-white xl:text-6xl">
          Del campo al control, sin perder información.
        </h1>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: Icon, title }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index + 0.15 }}
              className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 backdrop-blur"
            >
              <Icon className="mb-3 size-5 text-cyan-300" />
              <div className="text-sm font-semibold text-slate-100">{title}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
