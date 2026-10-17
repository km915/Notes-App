// sync.js — Google Drive sign-in and syncing notes.json (merge: newest edit per item wins).
// Needs: core.js (D, L, CID, SCOPE); calls draw() from notes.js
// Loaded 4th (plain <script> tags in index.html share one global scope; order matters).

// ---- Google Drive sync (one file: notes.json) ----
const ST={'○':'Not synced: offline or not connected','◐':'Syncing…','●':'Synced','!':'Sync failed: tap again to reconnect'};
let stAsk=0; // 1 after a tap on the sync button (phone): the result is shown as a short message
const setSt=s=>{$('#st').textContent=s;if(stAsk&&s!='◐'){stAsk=0;toast(ST[s],1800)}}; // ○ local only/offline  ◐ syncing  ● synced  ! tap to reconnect
const syncNow=()=>{L.link=1;if(phone()){stAsk=1;toast(ST['◐'],1800)}sync()};
const gis=()=>window.google&&google.accounts?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=ok;s.onerror=no;document.head.append(s)});
const login=()=>new Promise(async(ok,no)=>{
 await gis();
 google.accounts.oauth2.initTokenClient({client_id:CID,scope:SCOPE,error_callback:no,callback:r=>{
  if(!r.access_token)return no(r);
  tok=L.tk=r.access_token;L.exp=Date.now()+r.expires_in*1e3-6e4;ok();
 }}).requestAccessToken();
});
const api=(u,o={})=>fetch('https://www.googleapis.com/'+u,{...o,headers:{Authorization:'Bearer '+tok,...o.headers}}).then(r=>{if(!r.ok)throw r.status;return r});
function merge(a,b){ // newest edit per item wins
 for(const k of['f','n','t']){
  a[k]=a[k]||[];
  const m=new Map(a[k].map(x=>[x.id,x]));
  for(const x of b[k]||[]){const y=m.get(x.id);if(!y||x.t>y.t)m.set(x.id,x)}
  a[k]=[...m.values()];
 }
}
async function sync(){
 if(!L.link||!navigator.onLine)return setSt('○');
 if(busy)return again=1;
 busy=1;setSt('◐');
 try{
  if(!tok||Date.now()>+L.exp)await login();
  let id=L.fid;
  if(!id)id=(await(await api('drive/v3/files?fields=files(id)&q='+encodeURIComponent("name='notes.json' and trashed=false"))).json()).files[0]?.id;
  if(!id)id=(await(await api('drive/v3/files',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"notes.json"}'})).json()).id;
  L.fid=id;
  const rs=await(await api(`drive/v3/files/${id}?alt=media`)).text();
  const R=rs?JSON.parse(rs):{f:[],n:[],t:[]};
  merge(D,R);
  const out=JSON.stringify(D);
  if(out!=JSON.stringify(R))await api('upload/drive/v3/files/'+id+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:out});
  L.d=JSON.stringify(D);setSt('●');draw();
 }catch(e){
  if(e==404)delete L.fid;
  if(e==401)L.exp=0;
  setSt(navigator.onLine?'!':'○');
 }
 busy=0;if(again){again=0;sync()}
}
addEventListener('online',sync);
addEventListener('offline',()=>setSt('○'));
document.addEventListener('visibilitychange',()=>document.visibilityState=='visible'&&sync());
setInterval(sync,6e4);

