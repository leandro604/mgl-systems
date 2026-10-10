import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/features/auth/forms'
import { getVerifiedSubject } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  const { userId } = await getVerifiedSubject()
  if (!userId) redirect('/forgot-password')
  return (
    <section>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Seguridad</span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Define una nueva contraseña</h1>
      <p className="mt-3 mb-8 text-sm leading-6 text-slate-400">La nueva contraseña se aplicará a tu cuenta de MGL Systems y cerrará este proceso de recuperación.</p>
      <ResetPasswordForm />
    </section>
  )
}
