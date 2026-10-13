import { ForgotPasswordForm } from '@/features/auth/forms'

export default function ForgotPasswordPage() {
  return (
    <section>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Recuperación</span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Recupera tu acceso</h1>
      <ForgotPasswordForm />
    </section>
  )
}
