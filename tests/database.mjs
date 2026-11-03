import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();await db.waitReady;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const state={schema:1,records:[{id:1,date:'2026-11-04',type:'收入',category:'課程',amount:1600,note:'test'}],templates:[],logo:null};
let count=0;
try {
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${A}'),('${B}');`);
 await db.exec(await fs.readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
 const actor=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(id?'set role authenticated':'set role anon');};
 const save=(s,v,id)=>db.query('select public.finance_write($1::jsonb,$2,$3::uuid) as result',[JSON.stringify(s),v,id]);
 const read=async()=> (await db.query('select public.finance_read() as result')).rows[0].result;
 const check=(x,name)=>{assert(x,name);count++;console.log('PASS',name);};
 await actor(null);await assert.rejects(read,e=>e.code==='42501');count++;console.log('PASS anonymous cannot execute ledger read');
 await actor(A);check((await read()).version===0,'new account starts with version zero');
 const request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 check((await save(state,0,request)).rows[0].result.version===1,'first write initializes ledger atomically');
 check((await save(state,0,request)).rows[0].result.version===1,'same request does not duplicate commit');
 await assert.rejects(()=>save({...state,records:[]},0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),e=>e.code==='40001');check((await read()).state.records.length===1,'stale version cannot replace ledger');
 await actor(B);check((await read()).state===null,'other account cannot read account A');
 check((await db.query('select * from public.finance_ledgers')).rows.length===0,'direct table access obeys RLS');
 const updated=await db.query('update public.finance_ledgers set version=99 where owner_id=$1 returning *',[A]);check(updated.rows.length===0,'other account cannot update account A');
 await assert.rejects(()=>db.query('insert into public.finance_ledgers(owner_id,state) values($1,$2::jsonb)',[A,JSON.stringify(state)]),e=>e.code==='42501');count++;console.log('PASS forged owner insert rejected');
 await actor(A);
 for(const bad of [{...state,records:[{...state.records[0],date:'2026-02-30'}]},{...state,records:[{...state.records[0],amount:-1}]},{...state,records:[{...state.records[0],amount:1.5}]},{...state,records:[state.records[0],state.records[0]]},{...state,records:[{id:1}]},{...state,logo:'data:image/svg+xml;base64,AAAA'}]){
  await assert.rejects(()=>save(bad,1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),e=>e.code==='22023');count++;
 }
 console.log('PASS database rejects invalid dates, amounts, duplicates, missing fields and SVG');
 check((await read()).version===1,'invalid writes leave previous version intact');
 await actor(null);await assert.rejects(()=>db.query('select * from public.finance_ledgers'),e=>e.code==='42501');count++;console.log('PASS anonymous table read rejected');
 await actor(A);await assert.rejects(()=>db.query('update public.finance_ledgers set owner_id=$1',[B]),e=>e.code==='42501');count++;console.log('PASS owner reassignment rejected');
 await assert.rejects(()=>db.query('delete from public.finance_ledgers'),e=>e.code==='42501');count++;console.log('PASS table-level deletion unavailable');
 console.log(`${count} database checks passed`);
}finally{await db.close();}
