import { redirect } from 'next/navigation'
import { LoginForm } from '@/features/auth/forms'
import { getVerifiedSubject } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const { userId } = await getVerifiedSubject()
  if (userId) redirect('/')

  return (
    <section>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Acceso seguro</span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Bienvenido a MGL Systems</h1>
      {error ? <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">No pudimos completar la verificación de acceso. Solicita un nuevo enlace o vuelve a intentarlo.</div> : null}
      <LoginForm />
    </section>
  )
}
