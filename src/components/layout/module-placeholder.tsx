import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function ModulePlaceholder({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mx-auto max-w-5xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p><h1 className="mt-2 text-3xl font-black text-white">{title}</h1></div><Card><CardContent className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Construction className="size-6" /></span><h2 className="mt-5 text-lg font-semibold text-slate-200">Próximamente</h2></CardContent></Card></div>
}
