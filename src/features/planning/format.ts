export const dependencyLabel: Record<string, string> = {
  FS: 'Fin → Inicio',
  SS: 'Inicio → Inicio',
  FF: 'Fin → Fin',
  SF: 'Inicio → Fin',
}

export const taskTypeLabel: Record<string, string> = {
  activity: 'Actividad',
  milestone: 'Hito',
  summary: 'Resumen EDT',
}

export function planningHealth(planned: number, actual: number) {
  const variance = actual - planned
  if (variance >= -2) return { label: 'En línea', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' }
  if (variance >= -10) return { label: 'En riesgo', className: 'border-amber-400/20 bg-amber-400/10 text-amber-200' }
  return { label: 'Atrasado', className: 'border-red-400/20 bg-red-400/10 text-red-200' }
}
