import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

describe('v0.18.3 visual refinement', () => {
  it('uses compact stage cards and a dedicated detail drawer', () => {
    const stages = source('src/features/projects/stage-dashboard-stages.tsx')
    const drawer = source('src/features/projects/stage-detail-drawer.tsx')
    expect(stages).toContain('min-h-[72px]')
    expect(stages).toContain('sm:grid-cols-2 xl:grid-cols-4')
    expect(stages).toContain('StageDetailDrawer')
    expect(drawer).toContain('Cotizado')
    expect(drawer).toContain('Desviación %')
  })

  it('moves the principal inline creation forms to drawers', () => {
    const tasks = source('src/features/tasks/project-tasks-board.tsx')
    const sst = source('src/features/sst/project-sst-panel.tsx')
    const inventory = source('src/app/(workspace)/app/projects/[projectId]/inventory/page.tsx')
    const purchases = source('src/app/(workspace)/app/projects/[projectId]/purchases/page.tsx')
    expect(tasks).toContain('title="Nueva tarea"')
    expect(sst).toContain('title="Nuevo registro SST"')
    expect(inventory).toContain('title="Nuevo requerimiento"')
    expect(purchases).toContain('title="Nueva orden de compra"')
  })

  it('uses the requested semantic badge scale', () => {
    const badge = source('src/components/ui/badge.tsx')
    expect(badge).toContain('h-5')
    expect(badge).toContain('bg-blue-50 text-blue-700')
    expect(badge).toContain('bg-green-50 text-green-700')
    expect(badge).toContain('bg-amber-50 text-amber-700')
    expect(badge).toContain('bg-red-50 text-red-700')
  })

  it('keeps notifications flat and without redundant refresh/unread controls', () => {
    const list = source('src/features/notifications/notification-list.tsx')
    const page = source('src/features/notifications/notifications-page-client.tsx')
    expect(list).not.toContain('Abrir detalle')
    expect(page).not.toContain('Actualizar')
    expect(page).not.toContain('Sin leer')
  })

  it('keeps the field today screen focused on tasks and requests', () => {
    const field = source('src/features/field/field-ui.tsx')
    expect(field).toContain('MIS TAREAS HOY')
    expect(field).toContain('MIS PETICIONES')
    expect(field).toContain('Nueva petición')
  })

  it('does not reintroduce audited explanatory copy', () => {
    const files = [
      'src/features/projects/stage-dashboard.tsx',
      'src/features/tasks/project-tasks-board.tsx',
      'src/features/fiscal/fiscal-settings-form.tsx',
      'src/features/planning/planning-workspace.tsx',
      'src/features/sst/project-sst-panel.tsx',
      'src/app/(workspace)/app/projects/[projectId]/inventory/page.tsx',
    ].map(source).join('\n')
    for (const phrase of [
      'Avance operativo y desviación',
      'Filtra el tablero',
      'La etapa es obligatoria',
      'Define qué tarea debe terminar',
      'Los secretos se cifran',
      'En ambiente Beta',
      'Barra principal = cronograma actual',
      'Catálogo corporativo visible',
      'Para saldo inicial, devolución',
    ]) expect(files).not.toContain(phrase)
  })
})
