import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/features/auth/forms'
import { getVerifiedSubject } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  const { userId } = await getVerifiedSubject()
  if (!userId) redirect('/forgot-password')
  return (
    <section>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Seguridad</span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Define una nueva contraseña</h1>
      <ResetPasswordForm />
    </section>
  )
}
