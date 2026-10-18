import { Building2, CloudCog, ShieldCheck, WifiOff } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import styles from './auth-visual.module.css'

const items = [
  { icon: Building2, title: 'Proyectos centralizados', description: 'Etapas, tareas y documentación en un solo workspace.' },
  { icon: WifiOff, title: 'Trabajo local-first', description: 'Continúa operando incluso cuando la conectividad de obra falla.' },
  { icon: CloudCog, title: 'Sincronización segura', description: 'Mantén los cambios de tu equipo conectados entre campo y oficina.' },
  { icon: ShieldCheck, title: 'Permisos por rol', description: 'Cada persona accede a las herramientas que necesita para su trabajo.' },
]

export function AuthVisual() {
  return (
    <section className={styles.presentation} aria-label="Conoce MGL Systems">
      <Logo priority className={styles.logo ?? ''} />
      <div className={styles.introduction}>
        <p className={styles.eyebrow}>Gestión de obra conectada</p>
        <h2 className={styles.headline}>Del campo al control, sin perder información.</h2>
        <p className={styles.description}>MGL Systems combina operación local, sincronización confiable y control por proyecto para equipos de construcción.</p>
      </div>
      <div className={styles.features}>
        {items.map(({ icon: Icon, title, description }) => (
          <article key={title} className={styles.featureCard}>
            <span className={styles.featureIcon}><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
