'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function(){
 const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/login-memory.js'),'utf8'),context);const Memory=vm.runInContext('FinanceLoginMemory',context);
 const make=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};};
 const local=make(),temporary=make();let memory=new Memory(()=>local,()=>temporary);const key=memory.authKey;
 assert.equal(memory.keepSignedIn,false);memory.storage.setItem(key,'test-session');assert.equal(local.getItem(key),null);assert.equal(temporary.getItem(key),'test-session');
 memory.saveEmail('test@example.invalid',true);memory=new Memory(()=>local,()=>temporary);assert.equal(memory.email,'test@example.invalid');
 memory.setKeepSignedIn(true);assert.equal(local.getItem(key),'test-session');assert.equal(temporary.getItem(key),null);const newTab=make();memory=new Memory(()=>local,()=>newTab);assert.equal(memory.storage.getItem(key),'test-session');
 memory.setKeepSignedIn(false);assert.equal(local.getItem(key),null);assert.equal(memory.storage.getItem(key),'test-session');
 memory.storage.setItem(key,'refreshed-session');assert.equal(local.getItem(key),null);
 memory.clearSession();assert.equal(memory.storage.getItem(key),null);assert.equal(memory.email,'test@example.invalid');
 memory.saveEmail('test@example.invalid',false);assert.equal(memory.email,'');assert.equal(local.getItem(memory.emailKey),null);assert.equal(new Memory(()=>local,()=>make()).rememberEmail,false);
 const l=make(),t=make();t.setItem(key,'old-session');const blocked={getItem:k=>l.getItem(k),removeItem:k=>l.removeItem(k),setItem(){throw Error('quota');}};
 const failure=new Memory(()=>blocked,()=>t);assert.throws(()=>failure.setKeepSignedIn(true),/quota/);assert.equal(t.getItem(key),'old-session');assert.equal(failure.keepSignedIn,false);
 assert(!fs.readFileSync(path.join(__dirname,'../site/login-memory.js'),'utf8').includes('login-password'));
 console.log('PASS email recall, opt-out, durable session, migration, token refresh, logout and storage failure');
};
