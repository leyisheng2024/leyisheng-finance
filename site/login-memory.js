'use strict';
// Stores session tokens only with opt-in. Passwords never enter Web Storage.
var FinanceLoginMemory=class {
  constructor(local,temporary){this.local=local;this.temporary=temporary;this.authKey='leyisheng-cloud-auth';this.modeKey='leyisheng-keep-signed-in';this.emailKey='leyisheng-login-email';this.emailModeKey='leyisheng-remember-email';this.storage={getItem:key=>this.getItem(key),setItem:(key,value)=>this.setItem(key,value),removeItem:key=>this.removeItem(key)};}
  readLocal(key){try{return this.local().getItem(key);}catch{return null;}}
  get keepSignedIn(){return this.readLocal(this.modeKey)==='yes';}
  get rememberEmail(){return this.readLocal(this.emailModeKey)!=='no';}
  get email(){return this.rememberEmail?(this.readLocal(this.emailKey)||''):'';}
  saveEmail(email,remember){const local=this.local();if(remember&&email)local.setItem(this.emailKey,email);else local.removeItem(this.emailKey);local.setItem(this.emailModeKey,remember?'yes':'no');}
  getItem(key){return (this.keepSignedIn?this.local():this.temporary()).getItem(key);}
  setItem(key,value){const primary=this.keepSignedIn?this.local():this.temporary();const other=this.keepSignedIn?this.temporary():this.local();primary.setItem(key,value);try{other.removeItem(key);}catch{/* Storage may be unavailable in private mode. */}}
  removeItem(key){let error=null;for(const get of [this.local,this.temporary]){try{get().removeItem(key);}catch(e){error=e;}}if(error)throw error;}
  setKeepSignedIn(enabled){
    const local=this.local(),temporary=this.temporary(),oldMode=local.getItem(this.modeKey),oldLocal=local.getItem(this.authKey),oldTemporary=temporary.getItem(this.authKey);
    const token=this.keepSignedIn?oldLocal:oldTemporary;
    try{
      const primary=enabled?local:temporary,other=enabled?temporary:local;
      if(token!==null)primary.setItem(this.authKey,token);else primary.removeItem(this.authKey);
      local.setItem(this.modeKey,enabled?'yes':'no');other.removeItem(this.authKey);
    }catch(error){
      for(const [store,key,value] of [[local,this.authKey,oldLocal],[temporary,this.authKey,oldTemporary],[local,this.modeKey,oldMode]]){try{if(value===null)store.removeItem(key);else store.setItem(key,value);}catch{/* Retain original storage error. */}}
      throw error;
    }
  }
  clearSession(){this.removeItem(this.authKey);}
};
