'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { inviteWorkspaceMemberAction } from './actions'
import type { AppRole, InviteMemberState } from './types'

const initialInvite: InviteMemberState = { status: 'idle', message: '' }
const validRoles = new Set<AppRole>(['admin','pm','supervisor','field_worker'])

type Project = { id: string; code: string; name: string }

type ImportRow = { email: string; role: AppRole }

export function TeamExcelImport({ projects, canManage }: { projects: Project[]; canManage: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!canManage) return null

  async function parse(file: File): Promise<ImportRow[]> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer() as any)
    const sheet = workbook.worksheets[0]
    if (!sheet) return []
    const rows: ImportRow[] = []
    sheet.eachRow((row, index) => {
      if (index === 1) return
      const email = String(row.getCell(1).text ?? '').trim().toLowerCase()
      const rawRole = String(row.getCell(2).text ?? 'field_worker').trim().toLowerCase().replaceAll(' ', '_')
      if (!email || !email.includes('@')) return
      const role = validRoles.has(rawRole as AppRole) ? rawRole as AppRole : 'field_worker'
      rows.push({ email, role })
    })
    return rows
  }

  async function handleFile(file: File | null) {
    if (!file || !projectId) return
    setBusy(true)
    setMessage(null)
    try {
      const rows = await parse(file)
      if (!rows.length) throw new Error('Sin filas válidas')
      let ok = 0
      const errors: string[] = []
      for (const row of rows.slice(0, 100)) {
        const form = new FormData()
        form.set('email', row.email)
        form.set('role', row.role)
        form.append('project_ids', projectId)
        const result = await inviteWorkspaceMemberAction(initialInvite, form)
        if (result.status === 'success') ok += 1
        else errors.push(row.email)
      }
      setMessage(errors.length ? `${ok} importados · ${errors.length} con error` : `${ok} importados`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo importar')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={projectId} onChange={(event)=>setProjectId(event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm" aria-label="Proyecto para importación">
        {projects.map((project)=><option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
      </select>
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(event)=>void handleFile(event.target.files?.[0] ?? null)} />
      <Button type="button" variant="secondary" size="sm" disabled={busy || !projectId} onClick={()=>inputRef.current?.click()}>
        {busy ? <Loader2 className="animate-spin"/> : <FileSpreadsheet/>}Importar Excel
      </Button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  )
}
