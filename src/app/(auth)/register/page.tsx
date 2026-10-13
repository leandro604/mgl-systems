import { redirect } from 'next/navigation'
import { RegisterForm } from '@/features/auth/forms'
import { getVerifiedSubject } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  const { userId } = await getVerifiedSubject()
  if (userId) redirect('/')

  return (
    <section>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Nueva empresa</span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Crea tu cuenta</h1>
      <RegisterForm />
    </section>
  )
}
