'use strict';
var CloudLedger = class {
  constructor(client, defaults) {this.client=client;this.defaults=defaults;this.state=null;this.version=null;this.updatedAt=null;this.busy=false;this.needsReload=true;}
  decode(data) {
    if (!data || !Number.isInteger(data.version) || data.version<0) throw Error('雲端回應格式不正確');
    return {state:FinanceCore.validateState(data.state??this.defaults), version:data.version, updatedAt:data.updated_at??null};
  }
  adopt(decoded) {this.state=decoded.state;this.version=decoded.version;this.updatedAt=decoded.updatedAt;this.needsReload=false;return this.state;}
  async load() {
    if(this.busy) throw Error('正在儲存，請稍候');
    this.busy=true;
    try {
      const {data,error}=await this.client.rpc('finance_read'); if(error)throw error;
      return this.adopt(this.decode(data));
    } catch(err) {this.needsReload=true;throw err;} finally {this.busy=false;}
  }
  async commit(proposed) {
    if(this.busy)throw Error('正在儲存，請勿重複操作');
    if(this.needsReload||this.version===null)throw Error('請先重新整理帳本再儲存');
    // No optimistic UI change: publish local state only after server acknowledgement.
    const state=FinanceCore.validateState(proposed);
    this.busy=true;
    try {
      const {data,error}=await this.client.rpc('finance_write',{p_state:state,p_expected_version:this.version,p_request_id:crypto.randomUUID()});
      if(error)throw error;
      return this.adopt(this.decode(data));
    } catch(err) {
      this.needsReload=true;
      if(err.code==='40001') throw Object.assign(Error('其他裝置已更新帳本，這次修改未寫入。請重新整理後再儲存；表單內容會保留。'),{code:'CONFLICT'});
      throw Object.assign(Error('尚無法確認雲端儲存結果。請恢復連線並重新整理，確認紀錄後再操作，避免重複記帳。'),{cause:err});
    } finally {this.busy=false;}
  }
  clear() {this.state=null;this.version=null;this.updatedAt=null;this.needsReload=true;}
};
