// sync.js — Google Drive sign-in and syncing notes.json (merge: newest edit per item wins).
// Needs: core.js (D, L, CID, SCOPE); calls draw() from notes.js, NATIVE and nativeLogin() from native.js
// Loaded 4th (plain <script> tags in index.html share one global scope; order matters).

// ---- Sync status: the button in the top bar ----
const ST={'○':'Not synced: offline or not connected','◐':'Syncing…','●':'Synced','!':'Sync failed: tap again to reconnect'};
let stAsk=0; // 1 after a tap on the sync button (phone): the result is shown as a short message
const setSt=s=>{$('#st').textContent=s;if(stAsk&&s!='◐'){stAsk=0;toast(ST[s],1800)}}; // ○ local only/offline  ◐ syncing  ● synced  ! tap to reconnect
const syncNow=()=>{L.link=1;if(phone()){stAsk=1;toast(ST['◐'],1800)}sync(true)}; // a tap or key press: the ONLY way a sign-in screen can appear

// ---- Sign-in: where an access token (valid about 1 hour) comes from ----
// 1. Website on Vercel, and the Android app: the login server (api/auth.js) keeps a long-lived refresh token in a
//    secure cookie and hands out fresh tokens silently. No popup, no re-login. Only the very first sign-in shows
//    Google: laptop = Google's page and back, Android app = Android's own account sheet (native.js).
// 2. No login server at this address (GitHub Pages, local files): Google's popup, and only when you tap.
let noSrv; // 1 = this address has no login server (found out on the first request)
async function srv(a,body){ // call the login server; null = nobody signed in (or no server: then noSrv=1)
 const r=await fetch('api/auth?a='+a,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
 const j=/json/.test(r.headers.get('content-type')||'')?await r.json().catch(()=>0):0;
 if(r.status==401)return null;
 if(r.ok&&j)return j;
 if(!j||r.status==404||r.status==501){noSrv=1;return null} // an HTML 404 page (GitHub Pages), or "not configured"
 throw r.status; // the server is there but failed (for example Google is down): not a reason to ask for a sign-in
}
const keep=r=>{tok=L.tk=r.access_token;L.exp=Date.now()+r.expires_in*1e3-6e4};
async function getTok(ui){ // ui = true only when the user just tapped
 if(tok&&Date.now()<+L.exp)return;
 if(!noSrv){
  const j=await srv('refresh');if(j)return keep(j);
  if(!noSrv){ // the server is there, but this device is not signed in yet
   if(!ui)throw 'ui';
   if(NATIVE){const n=await nativeLogin();if(!n)throw 'noserver';return keep(n)}
   location.assign('api/auth?a=start');return new Promise(()=>{}); // leaves for Google's page; the server sends us back here
  }
 }
 if(NATIVE)throw 'noserver'; // Google's popup cannot work inside the app, so the app needs the login server
 if(!ui)throw 'ui';
 await login();
}
async function signOut(){
 try{await fetch('api/auth?a=logout',{method:'POST'})}catch(e){}
 tok='';['tk','exp','link','fid'].forEach(k=>delete L[k]);setSt('○');toast('Signed out on this device');
}
const gis=()=>window.google&&google.accounts?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=ok;s.onerror=no;document.head.append(s)});
const login=()=>new Promise(async(ok,no)=>{ // Google's popup (only without a login server)
 await gis();
 google.accounts.oauth2.initTokenClient({client_id:CID,scope:SCOPE,error_callback:no,callback:r=>{
  if(!r.access_token)return no(r);
  keep(r);ok();
 }}).requestAccessToken();
});

// ---- Drive ----
const api=(u,o={})=>fetch('https://www.googleapis.com/'+u,{...o,headers:{Authorization:'Bearer '+tok,...o.headers}}).then(r=>{if(!r.ok)throw r.status;return r});
function merge(a,b){ // newest edit per item wins
 for(const k of['f','n','t']){
  a[k]=a[k]||[];
  const m=new Map(a[k].map(x=>[x.id,x]));
  for(const x of b[k]||[]){const y=m.get(x.id);if(!y||x.t>y.t)m.set(x.id,x)}
  a[k]=[...m.values()];
 }
}
async function sync(ui){ // ui===true only from syncNow(); timers, focus and saves never open a sign-in
 ui=ui===true;
 if(!L.link||!navigator.onLine)return setSt('○');
 if(busy){if(again!=2)again=ui?2:1;return}
 busy=1;setSt('◐');
 try{
  await getTok(ui);
  let id=L.fid;
  if(!id)id=(await(await api('drive/v3/files?fields=files(id)&q='+encodeURIComponent("name='notes.json' and trashed=false"))).json()).files[0]?.id;
  if(!id)id=(await(await api('drive/v3/files',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"notes.json"}'})).json()).id;
  L.fid=id;
  const rs=await(await api(`drive/v3/files/${id}?alt=media`)).text();
  const R=rs?JSON.parse(rs):{f:[],n:[],t:[]};
  merge(D,R);
  const out=JSON.stringify(D);
  if(out!=JSON.stringify(R))await api('upload/drive/v3/files/'+id+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:out});
  L.d=JSON.stringify(D);setSt('●');draw();plan(); // plan(): the merge may have brought new tasks from another device
 }catch(e){
  if(e==404)delete L.fid;
  if(e==401)L.exp=0;
  if(e=='noserver')toast('The app needs the login server: see SETUP.md',5000);
  setSt(navigator.onLine?'!':'○');
 }
 busy=0;if(again){const u=again==2;again=0;sync(u)}
}
addEventListener('online',()=>sync());
addEventListener('offline',()=>setSt('○'));
document.addEventListener('visibilitychange',()=>document.visibilityState=='visible'&&sync());
setInterval(sync,6e4);
