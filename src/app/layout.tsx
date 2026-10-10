import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: { default: 'MGL Systems', template: '%s · MGL Systems' },
  description: 'Plataforma local-first para gestión de proyectos de construcción.',
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="es"><body><Providers>{children}</Providers></body></html>
}
