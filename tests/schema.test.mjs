/** PostgreSQL real (WASM/PGlite). Auth y roles simulados; sin servicios Supabase.
 * Las pruebas negativas usan SAVEPOINT: un fallo no deja abortada la suite.
 */
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
const results=[];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const C=id(1), D=id(2), A=id(11), W=id(12), S=id(13), P=id(14), B=id(15), X=id(21);
const PROJ=id(101), OTHER=id(102), FOREIGN=id(201), TASK=id(301), TASK2=id(302), INV=id(401), INV2=id(402), SUP=id(501), PO=id(601), SERIES=id(701);
const BUD=id(801), BUD_GROUP=id(802), BUD_ITEM=id(803), PROGRESS=id(804), VAL=id(805), VAL_LINE=id(806), PO2=id(807);
const MAT=id(901), WH1=id(902), WH2=id(903), REQ=id(904), REQ_LINE=id(905), TX_IN=id(906), TX_IN_LINE=id(907), TX_OUT=id(908), TX_OUT_LINE=id(909), TX_TR=id(910), TX_TR_LINE=id(911), PO3=id(912), PO3_LINE=id(913), TX_PO=id(914), TX_PO_LINE=id(915);
const TX_BAD=id(916), TX_BAD_LINE=id(917);
const PLAN_SUM=id(1001), PLAN_A=id(1002), PLAN_M=id(1003), PLAN_DEP=id(1004);
let tick=0;
const version=()=>`updated_at=clock_timestamp()+interval '${++tick} milliseconds',mutation_id=gen_random_uuid()`;
async function sql(q){return db.query(q);}
async function as(user){await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',false);`);}
async function root(){await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false);`);}
async function test(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.message});throw e;}}
async function denied(q,code){await db.exec('SAVEPOINT expected_failure');let error;try{await sql(q);}catch(e){error=e;}await db.exec('ROLLBACK TO SAVEPOINT expected_failure; RELEASE SAVEPOINT expected_failure');assert.ok(error,'Expected SQL rejection');if(code)assert.equal(error.code,code);}
async function count(table,n){const r=await sql(`select count(*)::int as n from public.${table}`);assert.equal(r.rows[0].n,n);}
try{
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;`);
await test('Schema executes transactionally',async()=>db.exec(await fs.readFile(new URL('../database/schema.sql',import.meta.url),'utf8')));
await test('Phase 3 onboarding SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase3-onboarding.sql',import.meta.url),'utf8')));
await test('Phase 5 financial SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase5-finance.sql',import.meta.url),'utf8')));
await test('Phase 6 project control SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase6-control.sql',import.meta.url),'utf8')));
await test('Phase 7 inventory SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase7-inventory.sql',import.meta.url),'utf8')));
await test('Phase 7 atomic inventory RPC SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase7-atomic-movement.sql',import.meta.url),'utf8')));
await test('Phase 7 inventory currency SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase7-inventory-currency.sql',import.meta.url),'utf8')));
await test('Phase 7 covering indexes SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase7-covering-indexes.sql',import.meta.url),'utf8')));
await test('Phase 8 planning SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase8-planning.sql',import.meta.url),'utf8')));
await test('Phase 8 planning integrity SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase8-integrity-guard.sql',import.meta.url),'utf8')));
await test('Phase 8 planning context SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase8-performance.sql',import.meta.url),'utf8')));
await test('Phase 8 covering indexes SQL executes',async()=>db.exec(await fs.readFile(new URL('../database/phase8-covering-indexes.sql',import.meta.url),'utf8')));
await db.exec('BEGIN');
await sql(`INSERT INTO auth.users VALUES('${B}');`);
await as(B);
let bootstrapCompanyId;
await test('Authenticated user can bootstrap company as initial admin',async()=>{
 const r=await sql(`SELECT public.bootstrap_company('Bootstrap Company','20100000009','Bootstrap Admin') AS payload`);
 const payload=r.rows[0].payload;
 assert.equal(payload.role,'admin');
 assert.equal(payload.already_provisioned,false);
 bootstrapCompanyId=payload.company_id;
 const c=await sql(`SELECT role FROM profiles WHERE user_id='${B}'`);
 assert.equal(c.rows[0].role,'admin');
});
await test('Company bootstrap is idempotent for the same authenticated user',async()=>{
 const r=await sql(`SELECT public.bootstrap_company('Bootstrap Company','20100000009','Bootstrap Admin') AS payload`);
 assert.equal(r.rows[0].payload.company_id,bootstrapCompanyId);
 assert.equal(r.rows[0].payload.already_provisioned,true);
});
await root();
await sql(`INSERT INTO companies(id,legal_name,ruc) VALUES('${C}','Company Alpha','20100000001'),('${D}','Company Beta','20100000002')`);
for(const [u,c,role] of [[A,C,'admin'],[W,C,'field_worker'],[S,C,'supervisor'],[P,C,'pm'],[X,D,'admin']]){
 await sql(`INSERT INTO auth.users VALUES('${u}');`);
 await sql(`INSERT INTO profiles(company_id,user_id,full_name,role) VALUES('${c}','${u}','Test ${role}','${role}')`);
}
await sql(`INSERT INTO projects(id,company_id,code,name,created_by) VALUES('${OTHER}','${C}','OTHER','Not assigned','${P}'),('${FOREIGN}','${D}','BETA','Foreign project','${X}')`);
await as(A);
await test('Create project RPC returns project and automatically assigns creator',async()=>{
 const r=await sql(`SELECT (public.create_project('${PROJ}','${C}','ALPHA','Project Alpha')).id`);assert.equal(r.rows[0].id,PROJ);
});
await test('Admin sees own company only',()=>count('companies',1));
await test('Admin sees only assigned project, not unassigned or foreign',()=>count('projects',1));
await test('Admin cannot update unassigned project',async()=>{const r=await sql(`UPDATE projects SET name='Forbidden',${version()} WHERE id='${OTHER}' RETURNING id`);assert.equal(r.rows.length,0);});
await test('Cannot create project for foreign company',()=>denied(`SELECT public.create_project('${id(999)}','${D}','BAD','Forbidden')`,'42501'));
for(const u of [W,S,P])await sql(`INSERT INTO project_members(company_id,project_id,user_id) VALUES('${C}','${PROJ}','${u}')`);
await test('Cross-company project member rejected by FK',()=>denied(`INSERT INTO project_members(company_id,project_id,user_id) VALUES('${C}','${PROJ}','${X}')`));
await sql(`INSERT INTO tasks(id,company_id,project_id,title,assignee_id) VALUES('${TASK}','${C}','${PROJ}','Assigned work','${W}'),('${TASK2}','${C}','${PROJ}','Other task','${S}')`);
await test('Cannot assign nonmember from another project/company',()=>denied(`UPDATE tasks SET assignee_id='${X}',${version()} WHERE id='${TASK}'`,'23514'));
await test('Cannot change tenant identity',()=>denied(`UPDATE tasks SET company_id='${D}',${version()} WHERE id='${TASK}'`,'23514'));
await test('Cannot physically delete tasks',()=>denied(`DELETE FROM tasks WHERE id='${TASK}'`,'42501'));
await test('Dependencies reject cycles',async()=>{
 await sql(`INSERT INTO task_dependencies(company_id,project_id,task_id,depends_on_task_id) VALUES('${C}','${PROJ}','${TASK}','${TASK2}')`);
 await denied(`INSERT INTO task_dependencies(company_id,project_id,task_id,depends_on_task_id) VALUES('${C}','${PROJ}','${TASK2}','${TASK}')`,'23514');
});
await test('LWW rejects stale update',()=>denied(`UPDATE tasks SET title='Stale',updated_at='2020-01-01',mutation_id=gen_random_uuid() WHERE id='${TASK}'`,'40001'));
await test('Clock guard rejects future writes',()=>denied(`UPDATE tasks SET title='Future',updated_at=now()+interval '1 day',mutation_id=gen_random_uuid() WHERE id='${TASK}'`,'22007'));
await test('Profile role cannot be self-escalated',()=>denied(`UPDATE profiles SET role='admin',${version()} WHERE user_id='${A}'`,'42501'));
await as(W);
await test('Worker sees project tasks',()=>count('tasks',2));
await test('Worker can update assigned task progress',async()=>{const r=await sql(`UPDATE tasks SET status='in_progress',progress=40,${version()} WHERE id='${TASK}' RETURNING id`);assert.equal(r.rows.length,1);});
await test('Worker cannot modify title',()=>denied(`UPDATE tasks SET title='Forbidden',${version()} WHERE id='${TASK}'`,'42501'));
await test('Worker cannot modify another assignee task',async()=>{const r=await sql(`UPDATE tasks SET status='in_progress',progress=10,${version()} WHERE id='${TASK2}' RETURNING id`);assert.equal(r.rows.length,0);});
await test('Worker cannot add project members',()=>denied(`INSERT INTO project_members(company_id,project_id,user_id) VALUES('${C}','${PROJ}','${A}')`));
await test('Worker can create self-assigned task',async()=>sql(`INSERT INTO tasks(id,company_id,project_id,title,assignee_id) VALUES('${id(303)}','${C}','${PROJ}','My new task','${W}')`));
await test('Worker cannot forge task creator',()=>denied(`INSERT INTO tasks(company_id,project_id,title,assignee_id,created_by) VALUES('${C}','${PROJ}','Forged','${W}','${A}')`,'42501'));
await test('Worker cannot forge synchronization logs',()=>denied(`INSERT INTO sync_logs(company_id,project_id,actor_id,entity_type,entity_id,operation,payload_hash,result) VALUES('${C}','${PROJ}','${W}','tasks','${TASK}','update',repeat('a',64),'applied')`,'42501'));
await as(A);
await test('Admin can create supplier master',async()=>sql(`INSERT INTO suppliers(id,company_id,legal_name,ruc,contact_name) VALUES('${SUP}','${C}','Proveedor Uno','20100000004','Compras')`));
await test('Purchase order snapshots selected supplier',async()=>{
 await sql(`INSERT INTO purchase_orders(id,company_id,project_id,number,supplier_id,supplier_name,created_by) VALUES('${PO}','${C}','${PROJ}','OC-001','${SUP}','placeholder','${A}')`);
 const r=await sql(`SELECT supplier_name,supplier_ruc,status FROM purchase_orders WHERE id='${PO}'`);
 assert.equal(r.rows[0].supplier_name,'Proveedor Uno');assert.equal(r.rows[0].supplier_ruc,'20100000004');assert.equal(r.rows[0].status,'draft');
});
await sql(`INSERT INTO purchase_order_items(company_id,project_id,purchase_order_id,line_number,description,quantity,unit_price) VALUES('${C}','${PROJ}','${PO}',1,'Material',2,50)`);
await test('Purchase order totals include IGV',async()=>{const r=await sql(`SELECT total_amount FROM purchase_order_totals WHERE id='${PO}'`);assert.equal(Number(r.rows[0].total_amount),118);});
await test('Purchase order state machine issues and receives',async()=>{
 let r=await sql(`SELECT public.transition_purchase_order('${PO}','issued') AS payload`);assert.equal(r.rows[0].payload.status,'issued');
 r=await sql(`SELECT public.transition_purchase_order('${PO}','received') AS payload`);assert.equal(r.rows[0].payload.status,'received');assert.ok(r.rows[0].payload.received_on);
});
await test('Issued purchase order lines are locked',()=>denied(`UPDATE purchase_order_items SET quantity=3,${version()} WHERE purchase_order_id='${PO}'`,'23514'));
await test('Purchase order cannot move backwards',()=>denied(`SELECT public.transition_purchase_order('${PO}','issued')`,'23514'));

await test('Admin can configure fiscal series',async()=>sql(`INSERT INTO fiscal_series(id,company_id,document_type,series,next_number) VALUES('${SERIES}','${C}','01','F001',100)`));
await test('Client cannot tamper fiscal next number',()=>denied(`UPDATE fiscal_series SET next_number=999,${version()} WHERE id='${SERIES}'`,'42501'));
await test('Admin can create invoice draft',async()=>sql(`INSERT INTO invoices(id,company_id,project_id,customer_document_type,customer_document_number,customer_name) VALUES('${INV}','${C}','${PROJ}','6','20100000003','Customer')`));
await test('Client cannot set SUNAT accepted status',()=>denied(`UPDATE invoices SET status='accepted',${version()} WHERE id='${INV}'`,'42501'));
await test('Client cannot forge CDR',()=>denied(`UPDATE invoices SET cdr_url='https://example.com/cdr',${version()} WHERE id='${INV}'`,'42501'));
await sql(`INSERT INTO invoice_items(company_id,project_id,invoice_id,line_number,description,quantity,unit_price) VALUES('${C}','${PROJ}','${INV}',1,'Service',2,100)`);
await test('Invoice totals calculated from decimal amounts',async()=>{const r=await sql(`select total_amount from invoice_totals where id='${INV}'`);assert.equal(Number(r.rows[0].total_amount),236);});
await as(S);
await test('Supervisor cannot read financial or supplier data',async()=>{await count('invoices',0);await count('invoice_items',0);await count('invoice_totals',0);await count('suppliers',0);await count('fiscal_series',0);await count('project_financial_summary',0);});
await root();
await test('Accepted invoice requires CDR evidence',()=>denied(`UPDATE invoices SET status='accepted',${version()} WHERE id='${INV}'`,'23514'));
await as(A);
await test('Invoice queue assigns configured fiscal sequence atomically',async()=>{
 const r=await sql(`SELECT public.queue_invoice('${INV}','F001') AS payload`);assert.equal(r.rows[0].payload.status,'queued');assert.equal(Number(r.rows[0].payload.number),100);assert.equal(r.rows[0].payload.series,'F001');
});
await test('Fiscal sequence advances for next invoice',async()=>{
 await sql(`INSERT INTO invoices(id,company_id,project_id,customer_document_type,customer_document_number,customer_name) VALUES('${INV2}','${C}','${PROJ}','6','20100000005','Customer Two')`);
 await sql(`INSERT INTO invoice_items(company_id,project_id,invoice_id,line_number,description,quantity,unit_price) VALUES('${C}','${PROJ}','${INV2}',1,'Other service',1,10)`);
 const r=await sql(`SELECT public.queue_invoice('${INV2}','F001') AS payload`);assert.equal(Number(r.rows[0].payload.number),101);
});
await test('Financial summary exposes committed costs and emitted invoices to admin',async()=>{const r=await sql(`SELECT committed_cost,received_cost,emitted_total FROM project_financial_summary WHERE project_id='${PROJ}'`);assert.equal(Number(r.rows[0].committed_cost),118);assert.equal(Number(r.rows[0].received_cost),118);assert.equal(Number(r.rows[0].emitted_total),247.8);});
await test('Admin can create draft budget version and hierarchy',async()=>{
 await sql(`INSERT INTO project_budgets(id,company_id,project_id,version_no,name,currency,created_by) VALUES('${BUD}','${C}','${PROJ}',1,'Baseline 1','PEN','${A}')`);
 await sql(`INSERT INTO budget_items(id,company_id,project_id,budget_id,code,description,item_type,quantity,unit_price,sort_order) VALUES('${BUD_GROUP}','${C}','${PROJ}','${BUD}','01','Cableado','group',0,0,1)`);
 await sql(`INSERT INTO budget_items(id,company_id,project_id,budget_id,parent_id,code,description,item_type,unit_code,quantity,unit_price,sort_order) VALUES('${BUD_ITEM}','${C}','${PROJ}','${BUD}','${BUD_GROUP}','01.01','Cable Cat 7A','item','MTR',100,10,2)`);
 const r=await sql(`SELECT budget_amount FROM budget_items WHERE id='${BUD_ITEM}'`);assert.equal(Number(r.rows[0].budget_amount),1000);
});
await test('Budget baseline activation freezes budget items',async()=>{
 const r=await sql(`SELECT public.activate_project_budget('${BUD}') AS payload`);assert.equal(r.rows[0].payload.status,'baseline');
 await denied(`UPDATE budget_items SET quantity=110,${version()} WHERE id='${BUD_ITEM}'`,'23514');
});
await test('Physical progress derives from executed quantities',async()=>{
 await sql(`INSERT INTO progress_records(id,company_id,project_id,budget_item_id,progress_on,quantity,created_by) VALUES('${PROGRESS}','${C}','${PROJ}','${BUD_ITEM}',current_date,25,'${A}')`);
 const r=await sql(`SELECT physical_progress_pct FROM budget_item_control WHERE budget_item_id='${BUD_ITEM}'`);assert.equal(Number(r.rows[0].physical_progress_pct),25);
});
await test('Purchase line can link active budget cost code',async()=>{
 await sql(`INSERT INTO purchase_orders(id,company_id,project_id,number,supplier_id,supplier_name,currency,created_by) VALUES('${PO2}','${C}','${PROJ}','OC-002','${SUP}','placeholder','PEN','${A}')`);
 await sql(`INSERT INTO purchase_order_items(company_id,project_id,purchase_order_id,budget_item_id,line_number,description,quantity,unit_price) VALUES('${C}','${PROJ}','${PO2}','${BUD_ITEM}',1,'Cable',10,20)`);
 await sql(`SELECT public.transition_purchase_order('${PO2}','issued')`);
 const r=await sql(`SELECT committed_net,budget_balance_net FROM budget_item_control WHERE budget_item_id='${BUD_ITEM}'`);assert.equal(Number(r.rows[0].committed_net),200);assert.equal(Number(r.rows[0].budget_balance_net),800);
});
await test('Valuation snapshots baseline unit price',async()=>{
 await sql(`INSERT INTO valuations(id,company_id,project_id,budget_id,number,period_start,period_end,created_by) VALUES('${VAL}','${C}','${PROJ}','${BUD}',1,current_date-6,current_date,'${A}')`);
 await sql(`INSERT INTO valuation_items(id,company_id,project_id,valuation_id,budget_item_id,quantity) VALUES('${VAL_LINE}','${C}','${PROJ}','${VAL}','${BUD_ITEM}',20)`);
 const r=await sql(`SELECT unit_price,amount FROM valuation_items WHERE id='${VAL_LINE}'`);assert.equal(Number(r.rows[0].unit_price),10);assert.equal(Number(r.rows[0].amount),200);
});
await test('Valuation state machine submits and approves',async()=>{
 let r=await sql(`SELECT public.transition_valuation('${VAL}','submitted') AS payload`);assert.equal(r.rows[0].payload.status,'submitted');
 r=await sql(`SELECT public.transition_valuation('${VAL}','approved') AS payload`);assert.equal(r.rows[0].payload.status,'approved');
});
await test('Approved valuation lines are immutable',()=>denied(`UPDATE valuation_items SET quantity=30,${version()} WHERE id='${VAL_LINE}'`,'23514'));
await test('Project control summary combines budget progress costs and valuations',async()=>{
 const r=await sql(`SELECT budget_total_net,committed_cost_net,approved_valuation_net,physical_progress_pct,unassigned_committed_net FROM project_control_summary WHERE project_id='${PROJ}'`);
 assert.equal(Number(r.rows[0].budget_total_net),1000);assert.equal(Number(r.rows[0].committed_cost_net),200);assert.equal(Number(r.rows[0].approved_valuation_net),200);assert.equal(Number(r.rows[0].physical_progress_pct),25);assert.equal(Number(r.rows[0].unassigned_committed_net),100);
});
await as(S);
await test('Supervisor cannot read project control financial data',async()=>{await count('project_budgets',0);await count('budget_items',0);await count('progress_records',0);await count('valuations',0);await count('valuation_items',0);await count('project_control_summary',0);});
await as(A);

// Fase 7 - inventario, requerimientos y almacenes
await test('Admin can create material catalog and project warehouses',async()=>{
 await sql(`INSERT INTO materials(id,company_id,sku,name,unit_code,min_stock) VALUES('${MAT}','${C}','MAT-001','Cable de prueba','MTR',2)`);
 await sql(`INSERT INTO warehouses(id,company_id,project_id,code,name,responsible_id) VALUES('${WH1}','${C}','${PROJ}','ALM-01','Almacén principal','${S}'),('${WH2}','${C}','${PROJ}','ALM-02','Almacén secundario','${P}')`);
 await count('materials',1);await count('warehouses',2);
});
await as(W);
await test('Worker can create and submit own material request',async()=>{
 await sql(`INSERT INTO material_requests(id,company_id,project_id,number,needed_on,requested_by) VALUES('${REQ}','${C}','${PROJ}','REQ-001',current_date+1,'${W}')`);
 await sql(`INSERT INTO material_request_items(id,company_id,project_id,request_id,material_id,budget_item_id,quantity) VALUES('${REQ_LINE}','${C}','${PROJ}','${REQ}','${MAT}','${BUD_ITEM}',5)`);
 const r=await sql(`SELECT public.transition_material_request('${REQ}','submitted') AS payload`);assert.equal(r.rows[0].payload.status,'submitted');
});
await test('Worker cannot approve material request',()=>denied(`SELECT public.transition_material_request('${REQ}','approved')`,'42501'));
await test('Worker cannot create inventory movement',()=>denied(`INSERT INTO inventory_transactions(company_id,project_id,number,movement_type,target_warehouse_id,created_by) VALUES('${C}','${PROJ}','NO-WORKER','adjustment_in','${WH1}','${W}')`,'42501'));
await as(S);
await test('Supervisor can approve material request',async()=>{const r=await sql(`SELECT public.transition_material_request('${REQ}','approved') AS payload`);assert.equal(r.rows[0].payload.status,'approved');assert.equal(r.rows[0].payload.approved_by,S);});
await test('Supervisor cannot edit company material catalog',()=>denied(`INSERT INTO materials(company_id,sku,name) VALUES('${C}','NO-SUP','Forbidden material')`,'42501'));
await as(A);
await test('Posted adjustment-in creates stock and value',async()=>{
 await sql(`INSERT INTO inventory_transactions(id,company_id,project_id,number,movement_type,target_warehouse_id,created_by) VALUES('${TX_IN}','${C}','${PROJ}','MOV-001','adjustment_in','${WH1}','${A}')`);
 await sql(`INSERT INTO inventory_transaction_items(id,company_id,project_id,transaction_id,material_id,quantity,unit_cost) VALUES('${TX_IN_LINE}','${C}','${PROJ}','${TX_IN}','${MAT}',10,20)`);
 const posted=await sql(`SELECT public.post_inventory_transaction('${TX_IN}') AS payload`);assert.equal(posted.rows[0].payload.status,'posted');
 const r=await sql(`SELECT quantity,stock_value,average_unit_cost FROM inventory_stock WHERE warehouse_id='${WH1}' AND material_id='${MAT}'`);
 assert.equal(Number(r.rows[0].quantity),10);assert.equal(Number(r.rows[0].stock_value),200);assert.equal(Number(r.rows[0].average_unit_cost),20);
});
await test('Atomic inventory RPC posts movement without leaving a draft',async()=>{
 await db.exec('SAVEPOINT phase7_atomic');
 const r=await sql(`SELECT public.create_inventory_movement('${PROJ}','MOV-ATOMIC','adjustment_in',NULL,'${WH1}',NULL,NULL,'${MAT}',NULL,NULL,NULL,1,7,'atomic') AS payload`);
 assert.equal(r.rows[0].payload.status,'posted');
 const c=await sql(`SELECT count(*)::int AS drafts FROM inventory_transactions WHERE number='MOV-ATOMIC' AND status='draft'`);assert.equal(c.rows[0].drafts,0);
 await db.exec('ROLLBACK TO SAVEPOINT phase7_atomic; RELEASE SAVEPOINT phase7_atomic');
});
await test('Inventory posting rejects insufficient stock',async()=>{
 await sql(`INSERT INTO inventory_transactions(id,company_id,project_id,number,movement_type,source_warehouse_id,material_request_id,created_by) VALUES('${TX_BAD}','${C}','${PROJ}','MOV-BAD','issue','${WH1}','${REQ}','${A}')`);
 await sql(`INSERT INTO inventory_transaction_items(id,company_id,project_id,transaction_id,material_id,request_item_id,quantity) VALUES('${TX_BAD_LINE}','${C}','${PROJ}','${TX_BAD}','${MAT}','${REQ_LINE}',20)`);
 await denied(`SELECT public.post_inventory_transaction('${TX_BAD}')`,'23514');
});
await test('Request issue uses average cost and fulfills request',async()=>{
 await sql(`INSERT INTO inventory_transactions(id,company_id,project_id,number,movement_type,source_warehouse_id,material_request_id,created_by) VALUES('${TX_OUT}','${C}','${PROJ}','MOV-002','issue','${WH1}','${REQ}','${A}')`);
 await sql(`INSERT INTO inventory_transaction_items(id,company_id,project_id,transaction_id,material_id,request_item_id,quantity) VALUES('${TX_OUT_LINE}','${C}','${PROJ}','${TX_OUT}','${MAT}','${REQ_LINE}',5)`);
 await sql(`SELECT public.post_inventory_transaction('${TX_OUT}')`);
 const line=await sql(`SELECT unit_cost FROM inventory_transaction_items WHERE id='${TX_OUT_LINE}'`);assert.equal(Number(line.rows[0].unit_cost),20);
 const req=await sql(`SELECT status FROM material_requests WHERE id='${REQ}'`);assert.equal(req.rows[0].status,'fulfilled');
 const f=await sql(`SELECT fulfilled_quantity,remaining_quantity FROM material_request_fulfillment WHERE request_item_id='${REQ_LINE}'`);assert.equal(Number(f.rows[0].fulfilled_quantity),5);assert.equal(Number(f.rows[0].remaining_quantity),0);
});
await test('Warehouse transfer preserves project stock value',async()=>{
 await sql(`INSERT INTO inventory_transactions(id,company_id,project_id,number,movement_type,source_warehouse_id,target_warehouse_id,created_by) VALUES('${TX_TR}','${C}','${PROJ}','MOV-003','transfer','${WH1}','${WH2}','${A}')`);
 await sql(`INSERT INTO inventory_transaction_items(id,company_id,project_id,transaction_id,material_id,quantity) VALUES('${TX_TR_LINE}','${C}','${PROJ}','${TX_TR}','${MAT}',2)`);
 await sql(`SELECT public.post_inventory_transaction('${TX_TR}')`);
 const r=await sql(`SELECT warehouse_id,quantity,stock_value FROM inventory_stock WHERE material_id='${MAT}' ORDER BY warehouse_id`);
 const byId=Object.fromEntries(r.rows.map(x=>[x.warehouse_id,x]));assert.equal(Number(byId[WH1].quantity),3);assert.equal(Number(byId[WH2].quantity),2);
 const p=await sql(`SELECT stock_value FROM project_inventory_summary WHERE project_id='${PROJ}'`);assert.equal(Number(p.rows[0].stock_value),100);
});
await test('Stock-controlled purchase line requires company base currency',async()=>{
 const poUsd='00000000-0000-4000-8000-000000000920';
 await sql(`INSERT INTO purchase_orders(id,company_id,project_id,number,supplier_id,supplier_name,currency,created_by) VALUES('${poUsd}','${C}','${PROJ}','OC-USD','${SUP}','placeholder','USD','${A}')`);
 await denied(`INSERT INTO purchase_order_items(company_id,project_id,purchase_order_id,material_id,line_number,description,quantity,unit_price) VALUES('${C}','${PROJ}','${poUsd}','${MAT}',1,'USD stock',1,10)`,'23514');
});
await test('Purchase receipt snapshots PO net cost into stock',async()=>{
 await sql(`INSERT INTO purchase_orders(id,company_id,project_id,number,supplier_id,supplier_name,currency,created_by) VALUES('${PO3}','${C}','${PROJ}','OC-003','${SUP}','placeholder','PEN','${A}')`);
 await sql(`INSERT INTO purchase_order_items(id,company_id,project_id,purchase_order_id,material_id,budget_item_id,line_number,description,unit_code,quantity,unit_price) VALUES('${PO3_LINE}','${C}','${PROJ}','${PO3}','${MAT}','${BUD_ITEM}',1,'Cable comprado','MTR',4,30)`);
 await sql(`SELECT public.transition_purchase_order('${PO3}','issued')`);
 await sql(`INSERT INTO inventory_transactions(id,company_id,project_id,number,movement_type,target_warehouse_id,purchase_order_id,created_by) VALUES('${TX_PO}','${C}','${PROJ}','MOV-004','receipt','${WH2}','${PO3}','${A}')`);
 await sql(`INSERT INTO inventory_transaction_items(id,company_id,project_id,transaction_id,material_id,purchase_order_item_id,quantity,unit_cost) VALUES('${TX_PO_LINE}','${C}','${PROJ}','${TX_PO}','${MAT}','${PO3_LINE}',4,999)`);
 await sql(`SELECT public.post_inventory_transaction('${TX_PO}')`);
 const l=await sql(`SELECT unit_cost FROM inventory_transaction_items WHERE id='${TX_PO_LINE}'`);assert.equal(Number(l.rows[0].unit_cost),30);
 const s=await sql(`SELECT quantity,stock_value FROM inventory_stock WHERE warehouse_id='${WH2}' AND material_id='${MAT}'`);assert.equal(Number(s.rows[0].quantity),6);assert.equal(Number(s.rows[0].stock_value),160);
});
await test('Posted inventory transaction and lines are immutable',async()=>{
 const tx=await sql(`UPDATE inventory_transactions SET notes='tampered',${version()} WHERE id='${TX_PO}' RETURNING id`);
 assert.equal(tx.rows.length,0);
 await denied(`UPDATE inventory_transaction_items SET quantity=99,${version()} WHERE id='${TX_PO_LINE}'`,'23514');
});
await test('Project inventory summary consolidates stock and open requests',async()=>{
 const r=await sql(`SELECT stock_value,sku_in_stock,warehouse_count,open_requests FROM project_inventory_summary WHERE project_id='${PROJ}'`);
 assert.equal(Number(r.rows[0].stock_value),220);assert.equal(Number(r.rows[0].sku_in_stock),1);assert.equal(Number(r.rows[0].warehouse_count),2);assert.equal(Number(r.rows[0].open_requests),0);
});

await test('Admin can structure WBS and typed CPM dependencies',async()=>{
 await sql(`UPDATE tasks SET starts_on='2026-10-01',due_on='2026-10-03',wbs_code='01.01',${version()} WHERE id='${TASK}'`);
 await sql(`UPDATE tasks SET starts_on='2026-10-04',due_on='2026-10-05',wbs_code='01.02',${version()} WHERE id='${TASK2}'`);
 await sql(`UPDATE tasks SET starts_on='2026-10-06',due_on='2026-10-07',wbs_code='01.03',${version()} WHERE id='${id(303)}'`);
 await sql(`INSERT INTO tasks(id,company_id,project_id,title,task_type,wbs_code,planned_weight,created_by) VALUES('${PLAN_SUM}','${C}','${PROJ}','02 Planificacion','summary','02',0,'${A}')`);
 await sql(`INSERT INTO tasks(id,company_id,project_id,title,task_type,wbs_code,parent_task_id,starts_on,due_on,planned_weight,budget_item_id,created_by) VALUES('${PLAN_A}','${C}','${PROJ}','Actividad planificada','activity','02.01','${PLAN_SUM}','2026-10-08','2026-10-12',2,'${BUD_ITEM}','${A}')`);
 await sql(`INSERT INTO tasks(id,company_id,project_id,title,task_type,wbs_code,parent_task_id,starts_on,due_on,planned_weight,created_by) VALUES('${PLAN_M}','${C}','${PROJ}','Hito contractual','milestone','02.02','${PLAN_SUM}','2026-10-14','2026-10-14',1,'${A}')`);
 await sql(`INSERT INTO task_dependencies(id,company_id,project_id,task_id,depends_on_task_id,dependency_type,lag_days) VALUES('${PLAN_DEP}','${C}','${PROJ}','${PLAN_M}','${PLAN_A}','FS',1)`);
 const r=await sql(`SELECT t.wbs_code,t.task_type,t.parent_task_id,d.dependency_type,d.lag_days FROM tasks t JOIN task_dependencies d ON d.task_id='${PLAN_M}' WHERE t.id='${PLAN_A}'`);
 assert.equal(r.rows[0].wbs_code,'02.01');assert.equal(r.rows[0].task_type,'activity');assert.equal(r.rows[0].parent_task_id,PLAN_SUM);assert.equal(r.rows[0].dependency_type,'FS');assert.equal(r.rows[0].lag_days,1);
});
await test('WBS hierarchy rejects a non-summary parent',()=>denied(`UPDATE tasks SET parent_task_id='${TASK}',${version()} WHERE id='${PLAN_A}'`,'23514'));
await test('A summary with active children cannot be demoted',()=>denied(`UPDATE tasks SET task_type='activity',${version()} WHERE id='${PLAN_SUM}'`,'23514'));
await test('CPM dependencies reject summary nodes',()=>denied(`INSERT INTO task_dependencies(company_id,project_id,task_id,depends_on_task_id,dependency_type) VALUES('${C}','${PROJ}','${PLAN_M}','${PLAN_SUM}','FS')`,'23514'));
await test('Milestone requires identical start and finish dates',()=>denied(`UPDATE tasks SET due_on='2026-10-15',${version()} WHERE id='${PLAN_M}'`,'23514'));
await test('Task progress changes are recorded for S-curve history',async()=>{
 await sql(`UPDATE tasks SET status='in_progress',progress=35,${version()} WHERE id='${PLAN_A}'`);
 const r=await sql(`SELECT progress,status FROM task_progress_history WHERE task_id='${PLAN_A}' ORDER BY recorded_at DESC,id DESC LIMIT 1`);
 assert.equal(r.rows[0].progress,35);assert.equal(r.rows[0].status,'in_progress');
});
let phase8BaselineId;
await test('Schedule baseline snapshots tasks/dependencies and versions immutably',async()=>{
 const first=await sql(`SELECT public.create_schedule_baseline('${PROJ}','Linea base contractual') AS payload`);
 phase8BaselineId=first.rows[0].payload.id;
 const snapshot=await sql(`SELECT count(*)::int AS tasks FROM schedule_baseline_tasks WHERE baseline_id='${phase8BaselineId}'`);
 assert.ok(snapshot.rows[0].tasks>=5);
 const dep=await sql(`SELECT dependency_type,lag_days FROM schedule_baseline_dependencies WHERE baseline_id='${phase8BaselineId}' AND dependency_id='${PLAN_DEP}'`);
 assert.equal(dep.rows[0].dependency_type,'FS');assert.equal(dep.rows[0].lag_days,1);
 const second=await sql(`SELECT public.create_schedule_baseline('${PROJ}','Linea base revisada') AS payload`);
 const status=await sql(`SELECT status FROM schedule_baselines WHERE id='${phase8BaselineId}'`);assert.equal(status.rows[0].status,'superseded');
 assert.equal(second.rows[0].payload.version_no,2);assert.equal(second.rows[0].payload.status,'active');
});
await test('Planning context RPC consolidates schedule in one read',async()=>{
 const r=await sql(`SELECT public.get_project_planning_context('${PROJ}') AS payload`);
 const payload=r.rows[0].payload;
 assert.ok(Array.isArray(payload.tasks));assert.ok(payload.tasks.some(t=>t.id===PLAN_A));assert.equal(payload.baseline.version_no,2);assert.ok(Array.isArray(payload.baseline_tasks));assert.ok(Array.isArray(payload.progress_history));
});

await test('Queued invoice no longer editable from client' ,async()=>{const r=await sql(`UPDATE invoices SET customer_name='Tampered',${version()} WHERE id='${INV}' RETURNING id`);assert.equal(r.rows.length,0);});
await test('Queued invoice lines locked even for administrators',()=>denied(`UPDATE invoice_items SET quantity=5,${version()} WHERE invoice_id='${INV}'`,'23514'));
await root();
await test('Issued invoice cannot be reopened as draft by server',()=>denied(`UPDATE invoices SET status='draft',${version()} WHERE id='${INV}'`,'23514'));
await test('Idempotency uniqueness per actor/company',async()=>{
 const q=`INSERT INTO sync_logs(company_id,project_id,actor_id,entity_type,entity_id,operation,payload_hash,result,mutation_id) VALUES('${C}','${PROJ}','${A}','tasks','${TASK}','update',repeat('a',64),'applied','${id(700)}')`;
 await sql(q);await denied(q,'23505');
});
await as(A);
await test('Soft-deleted task remains readable as synchronization tombstone',async()=>{await sql(`UPDATE tasks SET deleted_at=now(),${version()} WHERE id='${TASK2}'`);const r=await sql(`SELECT deleted_at FROM tasks WHERE id='${TASK2}'`);assert.ok(r.rows[0].deleted_at);});
await test('Revoked member loses project access',async()=>{await sql(`UPDATE project_members SET deleted_at=now(),${version()} WHERE project_id='${PROJ}' AND user_id='${W}'`);await as(W);await count('projects',0);await count('tasks',0);});
await as(X);
await test('Foreign company sees no Alpha tasks or invoices',async()=>{await count('tasks',0);await count('invoices',0);});
await root();
await test('All 30 tables have RLS and soft delete',async()=>{const r=await sql(`select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and exists(select 1 from information_schema.columns a where a.table_schema='public' and a.table_name=c.relname and a.column_name='deleted_at')`);assert.equal(r.rows[0].n,30);});
await db.exec('SET ROLE anon');
await test('Anonymous cannot read projects',()=>denied('SELECT * FROM projects','42501'));
await test('Anonymous cannot execute project RPC',()=>denied(`SELECT create_project('${id(888)}','${C}','NO','No access')`,'42501'));
await test('Anonymous cannot execute company bootstrap RPC',()=>denied(`SELECT bootstrap_company('No Access','20100000010','Anonymous User')`,'42501'));
await test('Anonymous cannot queue invoices',()=>denied(`SELECT queue_invoice('${INV}','F001')`,'42501'));
await test('Anonymous cannot transition purchase orders',()=>denied(`SELECT transition_purchase_order('${PO}','received')`,'42501'));
await test('Anonymous cannot activate budgets',()=>denied(`SELECT activate_project_budget('${BUD}')`,'42501'));
await test('Anonymous cannot transition valuations',()=>denied(`SELECT transition_valuation('${VAL}','submitted')`,'42501'));
await test('Anonymous cannot transition material requests',()=>denied(`SELECT transition_material_request('${REQ}','cancelled')`,'42501'));
await test('Anonymous cannot post inventory transactions',()=>denied(`SELECT post_inventory_transaction('${TX_BAD}')`,'42501'));
await test('Anonymous cannot create atomic inventory movements',()=>denied(`SELECT create_inventory_movement('${PROJ}','NO','adjustment_in',NULL,'${WH1}',NULL,NULL,'${MAT}',NULL,NULL,NULL,1,0,'')`,'42501'));
await test('Anonymous cannot create schedule baselines',()=>denied(`SELECT create_schedule_baseline('${PROJ}','No access')`,'42501'));
await test('Anonymous cannot execute planning context RPC',()=>denied(`SELECT get_project_planning_context('${PROJ}')`,'42501'));
await root();
await db.exec('ROLLBACK');
}catch(e){console.error(e.message,e.code,e.where);process.exitCode=1;}
finally{await fs.writeFile(new URL('./results.json',import.meta.url),JSON.stringify({engine:'PGlite PostgreSQL; Supabase Auth stub',tested_at:new Date().toISOString(),tests:results},null,2));console.log(results.map(r=>`${r.status} ${r.name}`).join('\n'));console.log(`${results.filter(r=>r.status==='PASS').length}/${results.length} tests passed`);await db.close();}
