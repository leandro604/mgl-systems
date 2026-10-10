import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function ModulePlaceholder({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mx-auto max-w-5xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p><h1 className="mt-2 text-3xl font-black text-white">{title}</h1><p className="mt-2 text-sm text-slate-400">{description}</p></div><Card><CardContent className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Construction className="size-6" /></span><h2 className="mt-5 text-lg font-semibold text-slate-200">Infraestructura preparada</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">La autenticación, el contexto de proyecto y el motor local-first ya están conectados. La operación completa de este módulo se implementará en su fase funcional sin romper esta base.</p></CardContent></Card></div>
}
