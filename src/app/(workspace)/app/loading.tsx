export default function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8" aria-label="Cargando módulo">
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded bg-slate-800" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-slate-800" />
        <div className="h-4 w-[28rem] max-w-full animate-pulse rounded bg-slate-900" />
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
        ))}
      </section>
      <div className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />
    </div>
  )
}
