import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams
  return (
    <section className="text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300"><MailCheck className="size-7" /></div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">Revisa tu correo</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Enviamos un enlace de verificación{email ? <> a <strong className="text-slate-200">{email}</strong></> : null}. Al confirmarlo volverás a MGL Systems para continuar con la configuración correspondiente.
      </p>
      <Button asChild variant="secondary" className="mt-7 w-full"><Link href="/login">Volver al inicio de sesión</Link></Button>
    </section>
  )
}
