import { z } from 'zod'
import type { Json } from '@/lib/supabase/database.types'
import type { PendingMutation, SyncResponse } from '@/types/domain'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const isoDateTime = z.string().datetime({ offset: true })

export const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done'])

export const taskCreatePayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(250),
    description: z.string().max(20_000).optional(),
    status: taskStatusSchema.optional(),
    priority: z.number().int().min(1).max(4).optional(),
    assignee_id: uuid.nullable().optional(),
    starts_on: isoDate.nullable().optional(),
    due_on: isoDate.nullable().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    position: z.number().finite().optional(),
    wbs_code: z.string().trim().max(50).optional(),
    task_type: z.enum(['activity', 'milestone', 'summary']).optional(),
    parent_task_id: uuid.nullable().optional(),
    planned_weight: z.number().finite().min(0).max(1_000_000).optional(),
    stage_id: uuid,
    budget_item_id: uuid.nullable().optional(),
  })
  .strict()

export const taskUpdatePayloadSchema = taskCreatePayloadSchema.partial().strict()

export const taskCanonicalSchema = z
  .object({
    title: z.string().trim().min(1).max(250),
    description: z.string(),
    status: taskStatusSchema,
    priority: z.number().int().min(1).max(4),
    assignee_id: uuid.nullable(),
    starts_on: isoDate.nullable(),
    due_on: isoDate.nullable(),
    progress: z.number().int().min(0).max(100),
    position: z.number().finite(),
    wbs_code: z.string().trim().max(50).default(''),
    task_type: z.enum(['activity', 'milestone', 'summary']).default('activity'),
    parent_task_id: uuid.nullable().default(null),
    planned_weight: z.number().finite().min(0).max(1_000_000).default(1),
    stage_id: uuid.nullable(),
    budget_item_id: uuid.nullable().default(null),
  })
  .superRefine((task, ctx) => {
    if (task.starts_on && task.due_on && task.due_on < task.starts_on) {
      ctx.addIssue({ code: 'custom', message: 'due_on cannot be before starts_on', path: ['due_on'] })
    }
    if (task.status === 'done' && task.progress !== 100) {
      ctx.addIssue({ code: 'custom', message: 'done tasks require progress=100', path: ['progress'] })
    }
    if (task.status !== 'done' && task.progress >= 100) {
      ctx.addIssue({ code: 'custom', message: 'progress=100 requires status=done', path: ['progress'] })
    }
    if (task.task_type === 'milestone' && (!task.starts_on || task.due_on !== task.starts_on)) {
      ctx.addIssue({ code: 'custom', message: 'milestones require the same start and finish date', path: ['due_on'] })
    }
  })

export const dependencyPayloadSchema = z
  .object({
    task_id: uuid,
    depends_on_task_id: uuid,
    dependency_type: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
    lag_days: z.number().int().min(-3650).max(3650).default(0),
  })
  .strict()
  .refine((value) => value.task_id !== value.depends_on_task_id, {
    message: 'A task cannot depend on itself',
    path: ['depends_on_task_id'],
  })

export const documentPayloadSchema = z
  .object({
    stage_id: uuid,
    description: z.string().trim().max(20_000).optional(),
    folder_path: z.string().trim().max(2000).refine((value) => !value.split(/[\\/]/).some((part) => part.trim() === '..' || part.trim() === '.'), 'Ruta de carpeta inválida').transform((value) => '/' + value.split(/[\\/]/).map((part) => part.trim()).filter(Boolean).join('/')).optional(),
    name: z.string().trim().min(1).max(255),
    provider: z.enum(['google_drive', 'onedrive']),
    provider_account_id: z.string().min(1).max(500),
    external_file_id: z.string().min(1).max(1000),
    web_url: z.string().url().refine((v) => v.startsWith('https://'), 'HTTPS required'),
    mime_type: z.string().min(1).max(255),
    size_bytes: z.number().int().nonnegative().safe(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  })
  .strict()

export const documentUpdatePayloadSchema = documentPayloadSchema.partial().strict()

export const sstPayloadSchema = z
  .object({
    record_type: z.enum(['inspection', 'incident', 'training', 'permit']),
    title: z.string().trim().min(1).max(250),
    occurred_at: isoDateTime,
    details: z.record(z.string(), jsonValueSchema).optional(),
    document_id: uuid.nullable().optional(),
  })
  .strict()

export const sstUpdatePayloadSchema = sstPayloadSchema.partial().strict()


export const budgetItemActualPayloadSchema = z
  .object({
    qty_actual: z.number().finite().nonnegative().optional(),
    unit_price_actual: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .refine((value) => value.qty_actual !== undefined || value.unit_price_actual !== undefined, {
    message: 'qty_actual or unit_price_actual is required',
  })



export const materialRequestPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])
export const materialRequestWorkflowStatusSchema = z.enum(['draft', 'pending', 'approved', 'rejected', 'delivered', 'cancelled'])

export const materialRequestCreatePayloadSchema = z.object({
  number: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(220),
  needed_on: isoDate.nullable().optional(),
  notes: z.string().max(20_000).optional(),
  approver_id: uuid,
  priority: materialRequestPrioritySchema.default('normal'),
  stage_id: uuid,
  budget_item_id: uuid.nullable().optional(),
}).strict()

export const materialRequestUpdatePayloadSchema = materialRequestCreatePayloadSchema.partial().strict()

export const materialRequestItemCreatePayloadSchema = z.object({
  request_id: uuid,
  material_id: uuid,
  budget_item_id: uuid.nullable().optional(),
  quantity: z.number().finite().positive(),
  estimated_unit_price: z.number().finite().nonnegative().default(0),
  notes: z.string().max(10_000).optional(),
}).strict()

export const materialRequestItemUpdatePayloadSchema = z.object({
  budget_item_id: uuid.nullable().optional(),
  quantity: z.number().finite().positive().optional(),
  estimated_unit_price: z.number().finite().nonnegative().optional(),
  notes: z.string().max(10_000).optional(),
}).strict()

export const materialRequestTransitionPayloadSchema = z.object({
  transition: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'delivered']),
  reason: z.string().trim().min(1).max(2_000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.transition === 'rejected' && !value.reason) {
    ctx.addIssue({ code: 'custom', message: 'El motivo es obligatorio', path: ['reason'] })
  }
})

export const pendingMutationSchema: z.ZodType<PendingMutation> = z.object({
  mutationId: uuid,
  entityId: uuid,
  companyId: uuid,
  projectId: uuid,
  actorId: uuid,
  entity: z.enum(['tasks', 'task_dependencies', 'documents', 'sst_records', 'budget_items', 'material_requests', 'material_request_items']),
  operation: z.enum(['create', 'update', 'soft_delete', 'restore']),
  updatedAt: isoDateTime,
  payload: z.record(z.string(), jsonValueSchema),
  dependsOnMutationIds: z.array(uuid),
})

export const syncResponseSchema: z.ZodType<SyncResponse> = z.object({
  result: z.enum(['applied', 'conflict', 'rejected']),
  mutation_id: uuid,
  entity: z.enum(['tasks', 'task_dependencies', 'documents', 'sst_records', 'budget_items', 'material_requests', 'material_request_items']).optional(),
  entity_id: uuid.optional(),
  row: z.record(z.string(), jsonValueSchema).nullable().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
})
