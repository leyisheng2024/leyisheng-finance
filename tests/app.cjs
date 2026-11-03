'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async function(){
 const nodes=new Map(),timers=[],alerts=[];
 function element(id=''){
  let value='',html='';const children=[];
  return {id,hidden:false,disabled:false,inert:false,checked:false,dataset:{},children,options:children,textContent:'',className:'',
   get value(){return value;},set value(v){value=String(v);},get innerHTML(){return html;},set innerHTML(v){html=v;children.length=0;},
   classList:{add(){},remove(){}},addEventListener(type,fn){this[type]=fn;},appendChild(e){children.push(e);},add(e){children.push(e);},focus(){},scrollIntoView(){},click(){},remove(){},reset(){for(const id of ['amount','note','editing-id'])get(id).value='';get('is-recurring').checked=false;}};
 }
 function get(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);}
 let remote={version:0,state:null,updated_at:null},fail=false;
 const fakeClient={rpc:async(name,args)=>{if(fail)return {error:{code:'NETWORK'}};if(name==='finance_read')return {data:structuredClone(remote)};if(args.p_expected_version!==remote.version)return {error:{code:'40001'}};remote={version:remote.version+1,state:structuredClone(args.p_state),updated_at:'2026-11-04T00:00:00Z'};return {data:structuredClone(remote)};},auth:{signOut:async()=>({})}};
 const sandbox={console,Date,JSON,Number,String,Set,Map,Math,Array,Error,RegExp,Promise,TextEncoder,crypto,structuredClone,Blob,URL,Option:function(text,value){this.text=text;this.value=value;},navigator:{onLine:true},location:{protocol:'https:'},sessionStorage:{removeItem(){}},document:{hidden:false,getElementById:get,createElement:element,addEventListener(){}},window:{addEventListener(){},scrollTo(){}},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},alert:m=>alerts.push(m),confirm:()=>true,__fakeClient:fakeClient};
 const context=vm.createContext(sandbox);const run=code=>vm.runInContext(code,context);
 const root=path.join(__dirname,'../site');for(const file of ['core.js','cloud-store.js','views.js','app.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
 const session={user:{id:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid'}};
 sandbox.__session=session;run('client=__fakeClient');await run('handleSession(__session)');assert.equal(get('app-shell').hidden,false);assert.equal(get('auth-panel').hidden,true);
 get('date').value='2026-11-04';get('type').value='收入';get('category').value='課程';get('amount').value='1600';get('note').value='<測試>';await run('saveTransaction({preventDefault(){}})');assert.equal(remote.state.records.length,1);assert.equal(get('total-income').textContent,'NT$ 1,600');assert.equal(get('amount').value,'');
 const id=remote.state.records[0].id;run(`editRecord(${id})`);get('amount').value='2000';await run('saveTransaction({preventDefault(){}})');assert.equal(remote.state.records[0].amount,2000);assert.equal(remote.state.records.length,1);
 get('amount').value='1500';get('note').value='未儲存草稿';fail=true;await run('saveTransaction({preventDefault(){}})');assert.equal(get('amount').value,'1500');assert.equal(get('note').value,'未儲存草稿');assert.equal(remote.state.records.length,1);assert.equal(run('records.length'),1);assert.equal(get('sync-status').dataset.error,'true');
 fail=false;await run('refreshLedger()');assert.equal(get('note').value,'未儲存草稿');await run('saveTransaction({preventDefault(){}})');assert.equal(remote.state.records.length,2);
 get('amount').value='800';get('note').value='固定課程';get('is-recurring').checked=true;get('repeat-count').value='3';get('repeat-freq').value='monthly';get('date').value='2026-01-31';await run('saveTransaction({preventDefault(){}})');assert.equal(remote.state.records.length,5);assert(remote.state.records.some(r=>r.date==='2026-02-28'));
 await run('logout()');assert.equal(get('app-shell').hidden,true);assert.equal(get('auth-panel').hidden,false);assert.equal(run('records.length'),0);assert.equal(get('records-tbody').children.length,0);assert.equal(get('note').value,'');
 assert.equal(alerts.length,0,alerts.join('; '));console.log('PASS application login/load/create/edit/failure recovery/recurring/logout integration');
};
