import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: { default: 'MGL Systems', template: '%s · MGL Systems' },
  description: 'Plataforma local-first para gestión de proyectos de construcción.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/mgl-32.png', type: 'image/png', sizes: '32x32' }],
    shortcut: '/icons/mgl-32.png',
    apple: [{ url: '/icons/mgl-apple-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'MGL Systems', statusBarStyle: 'default' },
}

export const viewport: Viewport = { themeColor: '#2563eb' }

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="es"><body><Providers>{children}</Providers></body></html>
}
