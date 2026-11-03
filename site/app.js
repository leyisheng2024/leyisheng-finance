'use strict';
let records=[], templates=[], logo=null, client=null, ledger=null, accountId=null, authEpoch=0;
let busy=false, loading=false, pollTimer=null, nextNumber=Date.now();
const validDate=FinanceCore.validDate;
const $=id=>document.getElementById(id);
function readLogo(){return logo;}
function currentState(){return {schema:1,records,templates,logo};}
function nextId(){nextNumber=Math.max(nextNumber+1,Date.now(),...records.map(r=>r.id+1),...templates.map(r=>r.id+1));return nextNumber;}
function setStatus(message,error=false){$('sync-status').textContent=message;$('sync-status').dataset.error=String(error);}
function setBusy(value){busy=value;$('ledger-content').inert=value;$('refresh-btn').disabled=value;$('logout-btn').disabled=value;}
function canWrite(){
  if(!accountId||!ledger||loading){alert('請先登入並載入帳本');return false;}
  if(busy){return false;}
  if(!navigator.onLine){setStatus('目前離線，尚未寫入。請連線後再儲存。',true);return false;}
  if(ledger.needsReload){alert('請先按「重新整理」，確認雲端帳務後再儲存。表單內容會保留。');return false;}
  return true;
}
function renderState(state){
  records=state.records.slice().sort((a,b)=>b.date.localeCompare(a.date));templates=state.templates;logo=state.logo;
  renderRecords();renderTemplates();updateRecentNotesDatalist();applyCustomLogo(logo||DEFAULT_LOGO);
}
function clearSensitive(){
  records=[];templates=[];logo=null;ledger?.clear();ledger=null;
  $('app-shell').hidden=true;$('auth-panel').hidden=false;
  $('transaction-form').reset();$('editing-id').value='';$('filter-keyword').value='';$('filter-type').value='all';
  $('records-tbody').innerHTML='';$('templates-container').innerHTML='';$('recent-notes').innerHTML='';
  $('account-name').textContent='';$('sync-status').textContent='';$('toast').classList.add('opacity-0');
  applyCustomLogo(DEFAULT_LOGO);renderRecords();
}
function syncedMessage(){return `已讀取雲端第 ${ledger.version} 版 · ${ledger.updatedAt?new Date(ledger.updatedAt).toLocaleString('zh-TW'):'尚無已儲存紀錄'}`;}
async function mutate(build,message){
  if(!canWrite())return false;
  const target=ledger, epoch=authEpoch;
  let proposed;
  try{proposed=FinanceCore.validateState(build(structuredClone(currentState())));}catch(err){alert(err.message);return false;}
  setBusy(true);setStatus('正在儲存至雲端…');
  try{
    const state=await target.commit(proposed);
    if(epoch!==authEpoch||target!==ledger)return false;
    renderState(state);setStatus(syncedMessage());showToast(message);return true;
  }catch(err){if(epoch===authEpoch)setStatus(err.message,true);return false;}
  finally{if(epoch===authEpoch)setBusy(false);}
}
function hasDraft(){return Boolean($('amount').value||$('note').value||$('editing-id').value||$('is-recurring').checked);}
async function refreshLedger(automatic=false){
  if(!ledger||busy||loading||!navigator.onLine||(automatic&&(hasDraft()||document.hidden)))return;
  const target=ledger,epoch=authEpoch;loading=true;
  if(!automatic)setBusy(true);
  try{
    const state=await target.load();
    if(epoch!==authEpoch||target!==ledger)return;
    renderState(state);setStatus(syncedMessage());
    const editing=$('editing-id').value;
    if(editing&&!records.some(r=>String(r.id)===editing)){
      $('editing-id').value='';$('form-title').textContent='原紀錄已刪除，目前表單將新增一筆';$('cancel-edit-btn').classList.remove('hidden');
    }
  }catch(err){if(epoch===authEpoch)setStatus('無法讀取雲端帳本，請確認網路或重新登入。已保留表單內容。',true);}
  finally{if(epoch===authEpoch){loading=false;setBusy(false);}}
}
async function handleSession(session){
  const id=session?.user?.id??null;
  if(id===accountId)return;
  authEpoch++;const epoch=authEpoch;accountId=id;clearInterval(pollTimer);clearSensitive();setBusy(false);loading=false;
  if(!id){$('auth-message').textContent='請登入帳本';return;}
  $('app-shell').hidden=false;$('auth-panel').hidden=true;$('account-name').textContent=session.user.email||'已登入';
  ledger=new CloudLedger(client,{schema:1,records:[],templates:structuredClone(defaultTemplates),logo:null});
  $('date').value=getTodayStr();$('filter-month').value=getTodayStr().slice(0,7);setType('收入');
  setStatus('正在讀取雲端帳本…');await refreshLedger();
  if(epoch===authEpoch)pollTimer=setInterval(()=>refreshLedger(true),20000);
}
async function logout(){
  if(busy)return;
  if(hasDraft()&&!confirm('表單尚有未儲存內容，確定登出並清除表單嗎？'))return;
  accountId=null;authEpoch++;clearInterval(pollTimer);clearSensitive();
  try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;$('auth-message').textContent='已登出';}
  catch{$('auth-message').textContent='本機畫面已清除；連線失敗，請關閉此分頁。';}
  finally{sessionStorage.removeItem('leyisheng-cloud-auth');}
}
async function saveTransaction(event){
  event.preventDefault();if(!canWrite())return;
  const editing=$('editing-id').value,date=$('date').value,type=$('type').value,category=$('category').value,amount=Number($('amount').value),note=$('note').value.trim()||'-';
  const recurring=$('is-recurring').checked&&!editing,count=recurring?Number($('repeat-count').value):1,freq=$('repeat-freq').value;
  if(!Number.isInteger(count)||count<1||count>100||(recurring&&count<2)){alert('重複次數請填 2 到 100');return;}
  const ok=await mutate(state=>{
    if(editing){const i=state.records.findIndex(r=>String(r.id)===editing);if(i<0)throw Error('這筆紀錄已不存在，請重新整理後新增');state.records[i]={id:Number(editing),date,type,category,amount,note};}
    else for(let i=0;i<count;i++)state.records.push({id:nextId(),date:recurring?FinanceCore.addDateOffset(date,freq,i):date,type,category,amount,note:recurring?`${note} (${i+1}/${count})`:note});
    return state;
  },editing?'修改已儲存至雲端':`已儲存 ${count} 筆紀錄至雲端`);
  if(ok){cancelEdit();$('is-recurring').checked=false;toggleRecurring();}
}
async function updateRecordDateInline(id,newDate){
  if(!validDate(newDate)){alert('日期不正確');renderRecords();return;}
  const ok=await mutate(state=>{const row=state.records.find(r=>r.id===id);if(!row)throw Error('紀錄不存在');row.date=newDate;return state;},'日期已儲存至雲端');
  if(!ok)renderRecords();
}
async function saveCurrentAsTemplate(){
  const item={id:nextId(),type:$('type').value,category:$('category').value,amount:Number($('amount').value),note:$('note').value.trim()};
  if(!item.note){alert('請填寫金額與專案備註');return;}
  await mutate(state=>{state.templates.push(item);return state;},'常用範本已儲存至雲端');
}
async function deleteTemplate(event,id){event.stopPropagation();await mutate(state=>{state.templates=state.templates.filter(r=>r.id!==id);return state;},'範本已刪除');}
async function duplicateRecordToForm(id,instantToday){
  const r=records.find(r=>r.id===id);if(!r)return;
  const note=r.note.replace(/\s*\(\d+\/\d+\)$/,'');
  if(instantToday){await mutate(state=>{state.records.push({...r,id:nextId(),date:getTodayStr(),note});return state;},'今日紀錄已儲存至雲端');}
  else{cancelEdit();setType(r.type);ensureCategory(r.category);$('amount').value=r.amount;$('note').value=note;$('date').focus();$('form-card').scrollIntoView({behavior:'smooth'});}
}
async function deleteRecord(id){
  if(!canWrite()||!confirm('確定刪除此筆雲端紀錄？所有裝置將同步刪除。'))return;
  if(await mutate(state=>{state.records=state.records.filter(r=>r.id!==id);return state;},'紀錄已從雲端刪除'))if($('editing-id').value===String(id))cancelEdit();
}
async function clearAllData(){
  if(!canWrite()||!confirm('即將清空這個帳號的全部雲端帳務，所有裝置都會受影響。請先下載完整備份。確定清空？'))return;
  if(await mutate(state=>({...state,records:[]}),'全部雲端帳務已清空'))cancelEdit();
}
async function uploadCustomLogo(event){
  const file=event.target.files[0];if(!file)return;
  try{
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>1024*1024)throw Error('請選擇 1 MB 以內的 PNG、JPEG、WebP 或 GIF 圖片');
    const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    await mutate(state=>({...state,logo:value}),'Logo 已儲存至雲端');
  }catch(err){alert(err.message);}finally{event.target.value='';}
}
function backupJSON(){
  if(!ledger?.state)return;
  saveFile(`樂頤生雲端完整備份_${getTodayStr()}.json`,JSON.stringify({version:3,exportedAt:new Date().toISOString(),cloudVersion:ledger.version,records,templates,logo},null,2));
  showToast('已產生目前已載入帳本的完整備份，請確認下載完成');
}
async function importJSON(event){
  const file=event.target.files[0];if(!file)return;
  try{
    if(!canWrite())return;if(file.size>6000000)throw Error('備份檔超過 6 MB');
    const incoming=FinanceCore.fromBackup(JSON.parse(await file.text()),currentState());
    if(!confirm(`將以備份的 ${incoming.records.length} 筆紀錄取代這個帳號的全部雲端帳本，其他裝置也會同步。請先下載現有備份。繼續？`))return;
    if(await mutate(()=>incoming,'備份已完整匯入雲端')){cancelEdit();$('filter-month').value='';renderRecords();}
  }catch(err){alert('無法匯入：'+err.message);}finally{event.target.value='';}
}
async function boot(){
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!client)return;$('login-btn').disabled=true;$('auth-message').textContent='正在登入…';
    try{const {data,error}=await client.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(error)throw error;$('login-password').value='';await handleSession(data.session);}
    catch{$('auth-message').textContent='登入失敗，請確認帳號、密碼與網路連線。';}
    finally{$('login-btn').disabled=false;}
  });
  $('transaction-form').addEventListener('submit',saveTransaction);$('refresh-btn').onclick=()=>refreshLedger();$('logout-btn').onclick=logout;
  const config=window.FINANCE_CONFIG||{};
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey||'')){
    $('auth-message').textContent='尚未連接雲端資料庫。請先完成管理者的上線設定。';$('login-btn').disabled=true;return;
  }
  if(!window.supabase?.createClient){$('auth-message').textContent='登入元件未載入，請重新整理。';$('login-btn').disabled=true;return;}
  try{
    client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{storage:sessionStorage,storageKey:'leyisheng-cloud-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>handleSession(session),0);});
    const {data,error}=await client.auth.getSession();if(error)throw error;
    if(data.session)await handleSession(data.session);else $('auth-message').textContent='請使用管理者建立的帳號登入';
  }catch{$('auth-message').textContent='無法初始化登入，請確認瀏覽器允許儲存並重新整理。';}
}
window.addEventListener('offline',()=>{if(accountId)setStatus('目前離線：已暫停寫入。已載入的帳務可檢視及下載備份。',true);});
window.addEventListener('online',()=>refreshLedger());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLedger(true);});
window.addEventListener('beforeunload',event=>{if(busy||hasDraft()){event.preventDefault();event.returnValue='';}});
let installEvent=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;$('install-btn').hidden=false;});
$('install-btn').onclick=async()=>{if(installEvent){await installEvent.prompt();installEvent=null;$('install-btn').hidden=true;}};
if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
document.addEventListener('DOMContentLoaded',boot);
