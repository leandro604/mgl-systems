import { redirect } from 'next/navigation'
import { RegisterForm } from '@/features/auth/forms'
import { getVerifiedSubject } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  const { userId } = await getVerifiedSubject()
  if (userId) redirect('/')

  return (
    <section>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Nueva empresa</span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Crea tu cuenta</h1>
      <p className="mt-3 mb-8 text-sm leading-6 text-slate-400">Usa este registro solo para crear una empresa nueva. Si recibiste una invitación de un equipo, abre el enlace del correo en lugar de crear otro workspace.</p>
      <RegisterForm />
    </section>
  )
}
