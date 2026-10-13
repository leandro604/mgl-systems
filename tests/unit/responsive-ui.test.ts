import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

describe('responsive manager UI foundation', () => {
  it('keeps a mobile/tablet navigation drawer and a mobile project selector', () => {
    const header = source('src/components/layout/workspace-header.tsx')
    expect(header).toContain('WorkspaceMobileNav')
    expect(header).toContain('<ProjectSwitcher projects={projects} mobile />')
  })

  it('prevents the workspace shell from forcing horizontal page overflow', () => {
    const layout = source('src/app/(workspace)/app/layout.tsx')
    const css = source('src/app/globals.css')
    expect(layout).toContain('mgl-workspace-main min-w-0')
    expect(css).toContain('.mgl-workspace {')
    expect(css).toContain('overflow-x: clip;')
  })

  it('uses touch-friendly horizontal navigation inside projects', () => {
    const nav = source('src/components/project/project-nav.tsx')
    expect(nav).toContain('overflow-x-auto')
    expect(nav).toContain('snap-x')
    expect(nav).toContain('mgl-hide-scrollbar')
  })

  it('renders dense budget items as cards on mobile and as a table from md', () => {
    const budget = source('src/features/budget/budget-items-table.tsx')
    expect(budget).toContain('space-y-3 md:hidden')
    expect(budget).toContain('hidden overflow-x-auto rounded-lg border border-slate-200 md:block')
  })

  it('renders manager material requests as compact rows on mobile', () => {
    const requests = source('src/features/material-requests/ui.tsx')
    expect(requests).toContain('divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white md:hidden')
    expect(requests).toContain('hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block')
  })
})
