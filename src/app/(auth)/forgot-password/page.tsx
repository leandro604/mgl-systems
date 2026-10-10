import { ForgotPasswordForm } from '@/features/auth/forms'

export default function ForgotPasswordPage() {
  return (
    <section>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Recuperación</span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Recupera tu acceso</h1>
      <p className="mt-3 mb-8 text-sm leading-6 text-slate-400">Ingresa tu correo. Si existe una cuenta asociada, Supabase enviará un enlace seguro de recuperación.</p>
      <ForgotPasswordForm />
    </section>
  )
}
