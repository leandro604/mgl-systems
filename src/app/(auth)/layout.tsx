import type { ReactNode } from 'react'
import { AuthVisual } from '@/components/auth/auth-visual'
import styles from '@/components/auth/auth-visual.module.css'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.layout}>
      <AuthVisual />
      <div className={styles.formArea}>
        <div className={styles.formCard}>
          {children}
        </div>
      </div>
    </main>
  )
}
