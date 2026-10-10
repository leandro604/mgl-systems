'use client'

import { motion } from 'framer-motion'
import { Building2, CloudCog, ShieldCheck, WifiOff } from 'lucide-react'
import { Logo } from '@/components/layout/logo'

const items = [
  { icon: Building2, title: 'Proyectos centralizados', text: 'Equipo, avance y documentación en un solo workspace.' },
  { icon: WifiOff, title: 'Trabajo local-first', text: 'Continúa operando incluso cuando la conectividad de obra falla.' },
  { icon: CloudCog, title: 'Sincronización segura', text: 'Outbox FIFO, idempotencia y reconciliación con Supabase.' },
  { icon: ShieldCheck, title: 'Permisos por rol', text: 'RLS y control de acceso por empresa y proyecto.' },
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
        <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
          MGL Systems combina operación local, sincronización confiable y control por proyecto para equipos de construcción.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, text }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index + 0.15 }}
              className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 backdrop-blur"
            >
              <Icon className="mb-3 size-5 text-cyan-300" />
              <div className="text-sm font-semibold text-slate-100">{title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <p className="relative z-10 text-xs text-slate-600">MGL Systems · Fase 8</p>
    </div>
  )
}
