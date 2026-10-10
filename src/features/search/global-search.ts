export type GlobalSearchKind = 'module' | 'project' | 'task' | 'document'

export type SearchProject = {
  id: string
  code: string
  name: string
}

export type SearchTask = {
  id: string
  project_id: string
  title: string
  description: string
  status: string
  wbs_code?: string | null
  deleted_at: string | null
  pending_sync?: boolean
}

export type SearchDocument = {
  id: string
  project_id: string
  name: string
  description: string
  folder_path: string
  mime_type: string
  deleted_at: string | null
  pending_sync?: boolean
}

export type GlobalSearchResult = {
  id: string
  kind: GlobalSearchKind
  title: string
  subtitle: string
  href: string
  searchText: string
  pendingSync?: boolean
}

export const GLOBAL_MODULES: GlobalSearchResult[] = [
  { id: 'module:dashboard', kind: 'module', title: 'Dashboard', subtitle: 'Resumen general del workspace', href: '/app', searchText: 'dashboard inicio resumen workspace' },
  { id: 'module:projects', kind: 'module', title: 'Proyectos', subtitle: 'Portafolio de proyectos', href: '/app/projects', searchText: 'proyectos portafolio obras' },
  { id: 'module:tasks', kind: 'module', title: 'Tareas', subtitle: 'Vista consolidada de tareas', href: '/app/tasks', searchText: 'tareas kanban pendientes actividades' },
  { id: 'module:documents', kind: 'module', title: 'Documentos', subtitle: 'Biblioteca documental', href: '/app/documents', searchText: 'documentos archivos biblioteca planos memorias metrados' },
  { id: 'module:sst', kind: 'module', title: 'SST', subtitle: 'Seguridad y salud en el trabajo', href: '/app/sst', searchText: 'sst seguridad salud trabajo incidentes inspecciones' },
  { id: 'module:inventory', kind: 'module', title: 'Almacén', subtitle: 'Inventario, stock y requerimientos', href: '/app/inventory', searchText: 'almacen inventario stock materiales requerimientos kardex' },
  { id: 'module:planning', kind: 'module', title: 'Planificación', subtitle: 'EDT, cronograma y curva S', href: '/app/planning', searchText: 'planificacion cronograma gantt edt wbs curva s cpm' },
  { id: 'module:control', kind: 'module', title: 'Control', subtitle: 'Presupuesto, avance y valorizaciones', href: '/app/control', searchText: 'control presupuesto costos valorizaciones avance' },
  { id: 'module:purchases', kind: 'module', title: 'Compras', subtitle: 'Proveedores y órdenes de compra', href: '/app/purchases', searchText: 'compras proveedores ordenes oc adquisiciones' },
  { id: 'module:invoices', kind: 'module', title: 'Facturación', subtitle: 'Comprobantes y series fiscales', href: '/app/invoices', searchText: 'facturacion facturas boletas comprobantes series' },
  { id: 'module:team', kind: 'module', title: 'Equipo', subtitle: 'Miembros y accesos', href: '/app/team', searchText: 'equipo usuarios miembros personal accesos' },
  { id: 'module:settings', kind: 'module', title: 'Configuración', subtitle: 'Preferencias del workspace', href: '/app/settings', searchText: 'configuracion ajustes preferencias cuenta' },
]

export function normalizeGlobalSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function projectName(projects: Map<string, SearchProject>, projectId: string): string {
  const project = projects.get(projectId)
  return project ? `${project.code} · ${project.name}` : 'Proyecto'
}

export function buildGlobalSearchIndex(input: {
  projects: SearchProject[]
  tasks: SearchTask[]
  documents: SearchDocument[]
}): GlobalSearchResult[] {
  const projects = new Map(input.projects.map((project) => [project.id, project]))
  const allowedProjects = new Set(projects.keys())

  const projectResults = input.projects.map<GlobalSearchResult>((project) => ({
    id: `project:${project.id}`,
    kind: 'project',
    title: project.name,
    subtitle: `Proyecto · ${project.code}`,
    href: `/app/projects/${project.id}`,
    searchText: `${project.code} ${project.name} proyecto`,
  }))

  const taskResults = input.tasks
    .filter((task) => !task.deleted_at && allowedProjects.has(task.project_id))
    .map<GlobalSearchResult>((task) => ({
      id: `task:${task.id}`,
      kind: 'task',
      title: task.title,
      subtitle: `Tarea · ${projectName(projects, task.project_id)}`,
      href: `/app/projects/${task.project_id}/tasks?focus=${encodeURIComponent(task.id)}`,
      searchText: `${task.title} ${task.description} ${task.status} ${task.wbs_code ?? ''} tarea ${projectName(projects, task.project_id)}`,
      pendingSync: Boolean(task.pending_sync),
    }))

  const documentResults = input.documents
    .filter((document) => !document.deleted_at && allowedProjects.has(document.project_id))
    .map<GlobalSearchResult>((document) => ({
      id: `document:${document.id}`,
      kind: 'document',
      title: document.name,
      subtitle: `Documento · ${projectName(projects, document.project_id)} · ${document.folder_path || '/'}`,
      href: `/app/projects/${document.project_id}/documents?focus=${encodeURIComponent(document.id)}`,
      searchText: `${document.name} ${document.description} ${document.folder_path} ${document.mime_type} documento archivo ${projectName(projects, document.project_id)}`,
      pendingSync: Boolean(document.pending_sync),
    }))

  return [...GLOBAL_MODULES, ...projectResults, ...taskResults, ...documentResults]
}

function scoreResult(result: GlobalSearchResult, normalizedQuery: string): number {
  if (!normalizedQuery) {
    const kindBase: Record<GlobalSearchKind, number> = { module: 50, project: 35, task: 20, document: 10 }
    return kindBase[result.kind]
  }

  const title = normalizeGlobalSearch(result.title)
  const subtitle = normalizeGlobalSearch(result.subtitle)
  const haystack = normalizeGlobalSearch(`${result.title} ${result.subtitle} ${result.searchText}`)
  const words = normalizedQuery.split(/\s+/).filter(Boolean)
  if (!words.every((word) => haystack.includes(word))) return -1

  let score = 0
  if (title === normalizedQuery) score += 120
  if (title.startsWith(normalizedQuery)) score += 80
  if (title.includes(normalizedQuery)) score += 55
  if (subtitle.includes(normalizedQuery)) score += 20

  for (const word of words) {
    if (title === word) score += 40
    else if (title.startsWith(word)) score += 25
    else if (title.split(' ').some((part) => part.startsWith(word))) score += 18
    else if (title.includes(word)) score += 12
    else if (subtitle.includes(word)) score += 6
    else score += 2
  }

  const kindBoost: Record<GlobalSearchKind, number> = { project: 8, task: 6, document: 4, module: 2 }
  return score + kindBoost[result.kind]
}

export function searchGlobalIndex(index: GlobalSearchResult[], query: string, limit = 24): GlobalSearchResult[] {
  const normalizedQuery = normalizeGlobalSearch(query)
  return index
    .map((result, position) => ({ result, position, score: scoreResult(result, normalizedQuery) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.position - b.position || a.result.title.localeCompare(b.result.title, 'es'))
    .slice(0, limit)
    .map((entry) => entry.result)
}
