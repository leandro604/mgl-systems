import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID as uuid } from 'node:crypto'
const db = new PGlite({ extensions: { pgcrypto } })
const read = path => fs.readFile(new URL('../' + path, import.meta.url), 'utf8')
try {
  await db.exec(`CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public,extensions TO authenticated,anon,service_role;`)
  for (const file of ['schema.sql','phase2-sync.sql','phase3-onboarding.sql','phase5-finance.sql','phase6-control.sql','phase7-inventory.sql','phase8-planning.sql']) await db.exec(await read('database/' + file))
  for (const file of (await fs.readdir(new URL('../database/task1/', import.meta.url))).filter(x => x.endsWith('.sql')).sort()) await db.exec(await read('database/task1/' + file))
  await db.exec(await read('database/task10-12/20260929_task10_material_fields.sql'))
  await db.exec(await read('database/final/01-task10-sync-engine.sql'))
  const migration = await read('database/notification-context.sql')
  assert.equal(migration,await read('supabase/migrations/20261028203912_contextual_notifications.sql'))
  await db.exec(migration)
  const company=uuid(), user=uuid(), project=uuid(), task=uuid(), request=uuid(), material=uuid()
  await db.query('INSERT INTO auth.users VALUES ($1)',[user])
  await db.query("INSERT INTO companies(id,legal_name,ruc) VALUES ($1,'Pruebas','20100000001')",[company])
  await db.query("INSERT INTO profiles(company_id,user_id,full_name,role) VALUES ($1,$2,'Leandro Mendoza','admin')",[company,user])
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user])
  await db.query("SELECT public.create_project($1,$2,'DEMO-TIC','Proyecto TIC')",[project,company])
  const stage=(await db.query("SELECT id FROM project_stages WHERE project_id=$1 AND code='04'",[project])).rows[0].id
  await db.query("INSERT INTO tasks(id,company_id,project_id,stage_id,title,assignee_id,created_by) VALUES ($1,$2,$3,$4,'Instalación de cámaras IP',$5,$5)",[task,company,project,stage,user])
  let notice=(await db.query("SELECT * FROM notifications WHERE entity_id=$1",[task])).rows[0]
  assert.equal(notice.title,'Instalación de cámaras IP asignada a Leandro Mendoza')
  assert.match(notice.body,/04_Ejecución en Campo · DEMO-TIC/)
  assert.equal(notice.action_url,`/app/projects/${project}/tasks?focus=${task}`)
  const assignee=uuid()
  await db.query('INSERT INTO auth.users VALUES ($1)',[assignee])
  await db.query("INSERT INTO profiles(company_id,user_id,full_name,role) VALUES ($1,$2,'Haldran Mendoza','field_worker')",[company,assignee])
  await db.query('INSERT INTO project_members(company_id,project_id,user_id) VALUES ($1,$2,$3)',[company,project,assignee])
  await db.query('UPDATE tasks SET assignee_id=$1,updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=$2',[assignee,task])
  assert.equal((await db.query('SELECT title FROM notifications WHERE entity_id=$1 AND recipient_id=$2',[task,assignee])).rows[0].title,'Instalación de cámaras IP reasignada a Haldran Mendoza')
  await db.query("UPDATE tasks SET title='Instalación revisada',updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=$1",[task])
  assert.equal((await db.query('SELECT count(*)::int AS total FROM notifications WHERE entity_id=$1',[task])).rows[0].total,2)
  await db.query("INSERT INTO materials(id,company_id,sku,name,unit_code) VALUES ($1,$2,'AP','AP WiFi 6','NIU')",[material,company])
  await db.query("INSERT INTO material_requests(id,company_id,project_id,stage_id,number,title,requested_by,approver_id) VALUES ($1,$2,$3,$4,'SM-001','Red inalámbrica',$5,$5)",[request,company,project,stage,user])
  await db.query('INSERT INTO material_request_items(company_id,project_id,request_id,material_id,quantity) VALUES ($1,$2,$3,$4,2)',[company,project,request,material])
  await db.query("UPDATE material_requests SET status='submitted',updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=$1",[request])
  const materialNotice=(await db.query("SELECT * FROM notifications WHERE entity_id=$1 AND kind='material_request_created'",[request])).rows[0]
  assert.equal(materialNotice.title,'Solicitud: 2 NIU AP WiFi 6')
  assert.match(materialNotice.body,/Solicitada por Leandro Mendoza · 04_Ejecución en Campo · DEMO-TIC/)
  assert.equal(materialNotice.action_url,`/app/peticiones/${request}`)
  await db.query("UPDATE material_requests SET status='approved',updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=$1",[request])
  const statusNotice=(await db.query("SELECT * FROM notifications WHERE entity_id=$1 AND kind='material_request_status'",[request])).rows[0]
  assert.equal(statusNotice.title,'SM-001 aprobada: 2 NIU AP WiFi 6')
  assert.equal(statusNotice.action_url,`/field/peticion/${request}`)
  await db.query("UPDATE notifications SET title='Petición de materiales actualizada',updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=$1",[statusNotice.id])
  const missing=uuid(),custom=uuid(),foreignProject=uuid()
  for (const [id,title,entity,projectId] of [[missing,'Nueva tarea asignada',uuid(),project],[custom,'Mensaje personalizado',task,project],[foreignProject,'Nueva tarea asignada',task,null]]) {
    await db.query("INSERT INTO notifications(id,company_id,project_id,recipient_id,kind,title,entity_type,entity_id,action_url) VALUES ($1,$2,$3,$4,'task_assigned',$5,'task',$6,'/app/tasks')",[id,company,projectId,user,title,entity])
  }
  const untouched=(await db.query('SELECT * FROM notifications WHERE id=ANY($1::uuid[]) ORDER BY id',[[missing,custom,foreignProject]])).rows
  await db.query("UPDATE notifications SET title='Nueva tarea asignada',read_at=clock_timestamp(),updated_at=clock_timestamp()+interval '1 minute',mutation_id=gen_random_uuid() WHERE id=$1",[notice.id])
  await db.query("UPDATE notifications SET title='Nueva petición de materiales',updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=$1",[materialNotice.id])
  const before=(await db.query('SELECT * FROM notifications WHERE id=$1',[notice.id])).rows[0]
  await db.exec(migration)
  notice=(await db.query('SELECT * FROM notifications WHERE id=$1',[notice.id])).rows[0]
  assert.equal(notice.title,'Instalación revisada asignada a Leandro Mendoza')
  for (const key of ['action_url','recipient_id','actor_id','entity_id']) assert.equal(notice[key],before[key])
  assert.deepEqual(notice.read_at,before.read_at)
  assert.ok(notice.version>before.version)
  assert.notEqual(notice.mutation_id,before.mutation_id)
  assert.ok(new Date(notice.server_updated_at)>=new Date(before.server_updated_at))
  assert.equal((await db.query('SELECT title FROM notifications WHERE id=$1',[materialNotice.id])).rows[0].title,'Solicitud: 2 NIU AP WiFi 6')
  assert.equal((await db.query('SELECT title FROM notifications WHERE id=$1',[statusNotice.id])).rows[0].title,'SM-001 aprobada: 2 NIU AP WiFi 6')
  assert.deepEqual((await db.query('SELECT * FROM notifications WHERE id=ANY($1::uuid[]) ORDER BY id',[[missing,custom,foreignProject]])).rows,untouched)
  const snapshot=await db.query('SELECT * FROM notifications ORDER BY id')
  await db.exec(migration)
  assert.deepEqual((await db.query('SELECT * FROM notifications ORDER BY id')).rows,snapshot.rows)
  await db.exec('SET ROLE authenticated')
  await assert.rejects(db.query('SELECT mgl_private.material_notification_summary($1,$2,$3)',[company,project,request]),/permission denied/)
  console.log('PASS contextual triggers, material quantities, links, safe idempotent backfill, sync versioning and helper permissions')
} finally { await db.close() }
