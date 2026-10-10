import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const db = new PGlite({ extensions: { pgcrypto } })
const read = (path) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8')
let passed = 0
try {
  await db.exec(`CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA extensions TO authenticated;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;`)
  for (const file of ['schema.sql', 'phase2-sync.sql', 'phase3-onboarding.sql', 'phase5-finance.sql', 'phase6-control.sql', 'phase7-inventory.sql', 'phase8-planning.sql']) await db.exec(await read('database/' + file))
  for (const file of (await fs.readdir(new URL('../database/task1/', import.meta.url))).filter((name) => name.endsWith('.sql')).sort()) await db.exec(await read('database/task1/' + file))
  await db.exec(await read('supabase/migrations/20260924183131_phase6_restore_private_rpc_grants.sql'))
  await db.exec(await read('database/task7/task7-document-search-sync.sql'))
  const company = randomUUID(), user = randomUUID(), project = randomUUID(), outsider = randomUUID(), otherCompany = randomUUID()
  await db.exec('BEGIN')
  await db.query(`INSERT INTO auth.users VALUES ($1), ($2)`, [user, outsider])
  await db.query(`INSERT INTO companies(id,legal_name,ruc) VALUES ($1,'Document tests','20100000001'),($2,'Foreign tests','20100000002')`, [company, otherCompany])
  await db.query(`INSERT INTO profiles(company_id,user_id,full_name,role) VALUES ($1,$2,'Document Admin','admin'),($3,$4,'Foreign Admin','admin')`, [company, user, otherCompany, outsider])
  await db.exec('SET ROLE authenticated')
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [user])
  await db.query(`SELECT public.create_project($1,$2,'DOC-TEST','Document test project')`, [project, company])
  const stages = (await db.query(`SELECT id,code FROM project_stages WHERE project_id=$1`, [project])).rows
  const stage = stages.find((row) => row.code === '01').id
  const locked = stages.find((row) => row.code === '98').id
  const document = randomUUID(), mutation = randomUUID()
  const payload = { name: 'Memoria de cálculo', provider: 'google_drive', provider_account_id: 'manual-link', external_file_id: 'test-file', web_url: 'https://drive.google.com/file/d/test-file/view', mime_type: 'application/pdf', size_bytes: 100, stage_id: stage, description: 'Diseño estructural', folder_path: '/01_Ingeniería/01_Input' }
  const timestamp = new Date().toISOString()
  async function rpc(id, operation, data, entity = document, time = new Date().toISOString()) {
    return (await db.query(`SELECT public.sync_mutation($1,'documents',$2,$3,$4,$5,$6::jsonb) AS result`, [id, entity, project, operation, time, JSON.stringify(data)])).rows[0].result
  }
  async function check(name, fn) { await fn(); passed++; console.log('PASS ' + name) }
  await check('document create persists searchable metadata with RLS', async () => {
    const response = await rpc(mutation, 'create', payload, document, timestamp)
    assert.equal(response.result, 'applied', JSON.stringify(response))
    assert.equal(response.row.stage_id, stage); assert.equal(response.row.folder_path, payload.folder_path)
    assert.ok(response.row.search_vector.includes('calcul'))
  })
  await check('duplicate receipt is idempotent', async () => {
    assert.equal((await rpc(mutation, 'create', payload, document, timestamp)).result, 'applied')
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM sync_logs WHERE mutation_id=$1`, [mutation])).rows[0].n, 1)
  })
  await check('metadata update survives the RPC', async () => {
    const response = await rpc(randomUUID(), 'update', { description: 'Revisión dos', folder_path: '/Planos', stage_id: stage })
    assert.equal(response.result, 'applied', JSON.stringify(response)); assert.equal(response.row.folder_path, '/Planos'); assert.equal(response.row.description, 'Revisión dos')
  })
  await check('stale update cannot overwrite newer metadata', async () => {
    assert.equal((await rpc(randomUUID(), 'update', { description: 'Stale' }, document, '2020-01-01T00:00:00Z')).result, 'conflict')
  })
  await check('closed quotation stage rejects new documents', async () => {
    const response = await rpc(randomUUID(), 'create', { ...payload, stage_id: locked, external_file_id: 'locked' }, randomUUID())
    assert.equal(response.result, 'rejected'); assert.equal(response.code, '42501')
  })
  await check('soft delete and restore preserve the reference', async () => {
    const removed = await rpc(randomUUID(), 'soft_delete', {})
    assert.equal(removed.result, 'applied'); assert.ok(removed.row.deleted_at)
    const restored = await rpc(randomUUID(), 'restore', {})
    assert.equal(restored.result, 'applied'); assert.equal(restored.row.folder_path, '/Planos')
  })
  await check('foreign company cannot access documents or mutate project', async () => {
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [outsider])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM documents')).rows[0].n, 0)
    await db.exec('SAVEPOINT denied')
    await assert.rejects(() => rpc(randomUUID(), 'update', { name: 'Forbidden' }))
    await db.exec('ROLLBACK TO SAVEPOINT denied')
  })
  await db.exec('RESET ROLE; ROLLBACK')
  console.log(`${passed}/${passed} document schema tests passed`)
} catch (error) { console.error(error); process.exitCode = 1 }
finally { await db.close() }
