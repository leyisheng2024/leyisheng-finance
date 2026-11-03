/* Shared, deterministic validation for imported files and cloud responses. */
'use strict';
var FinanceCore = (() => {
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y,m,d] = value.split('-').map(Number);
    const dt = new Date(0); dt.setFullYear(y,m-1,d);
    return y >= 1900 && y <= 9999 && dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d;
  }
  function validateItems(items, template=false, repairIds=false) {
    if (!Array.isArray(items) || items.length > (template ? 200 : 10000)) throw Error(template?'範本最多 200 筆':'帳務最多 10,000 筆');
    const ids = new Set();
    return items.map((r,i) => {
      if (!r || !['收入','支出'].includes(r.type) || typeof r.category!=='string' || !r.category.length || r.category.length>500 || typeof r.note!=='string' || r.note.length>2000 || !Number.isSafeInteger(r.amount) || r.amount<=0 || r.amount>1000000000 || (!template&&!validDate(r.date))) throw Error(`第 ${i+1} 筆的類型、日期、金額或文字不正確（金額上限十億元）`);
      let id = r.id;
      if (!Number.isSafeInteger(id) || id<=0 || ids.has(id)) {
        if (!repairIds) throw Error(`第 ${i+1} 筆識別碼重複或不正確`);
        id=Date.now()+i; while(ids.has(id)) id++;
      }
      ids.add(id);
      return {id,type:r.type,category:r.category,amount:r.amount,note:r.note,...(template?{}:{date:r.date})};
    });
  }
  function validateState(value) {
    if (!value || value.schema!==1) throw Error('不支援的帳本格式');
    const logo=value.logo??null;
    if (logo!==null && (typeof logo!=='string' || logo.length>1400000 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(logo))) throw Error('Logo 格式錯誤或超過 1 MB');
    const result={schema:1,records:validateItems(value.records),templates:validateItems(value.templates,true),logo};
    if (new TextEncoder().encode(JSON.stringify(result)).length>4000000) throw Error('帳本超過 4 MB，請先封存舊年度資料');
    return result;
  }
  function fromBackup(parsed,current) {
    if (Array.isArray(parsed)) return validateState({...current,records:validateItems(parsed,false,true)});
    if (!parsed || ![2,3].includes(parsed.version)) throw Error('不支援的備份版本');
    return validateState({schema:1,records:validateItems(parsed.records,false,true),templates:validateItems(parsed.templates,true,true),logo:parsed.logo??null});
  }
  function addDateOffset(value,freq,step) {
    if (!validDate(value) || !['daily','weekly','biweekly','monthly'].includes(freq) || !Number.isInteger(step) || step<0 || step>99) throw Error('重複日期設定不正確');
    const [y,m,d]=value.split('-').map(Number); const dt=new Date(y,m-1,d);
    if(freq==='monthly') {dt.setDate(1);dt.setMonth(dt.getMonth()+step);dt.setDate(Math.min(d,new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate()));}
    else dt.setDate(dt.getDate()+step*({daily:1,weekly:7,biweekly:14}[freq]));
    const result=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    if (!validDate(result)) throw Error('重複日期超出支援範圍'); return result;
  }
  return {validDate,validateItems,validateState,fromBackup,addDateOffset};
})();
