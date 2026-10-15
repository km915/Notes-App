// Network first (so updates arrive automatically), cache fallback (so it works offline).
// When you add a new file to the app, add it to FILES too.
const C='notes',FILES=['./','index.html','style.css','core.js','notes.js','calendar.js','sync.js','app.js','manifest.json','icon.png'];
addEventListener('install',e=>{skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)))});
addEventListener('activate',e=>e.waitUntil(clients.claim()));
addEventListener('fetch',e=>{
 const r=e.request;
 if(r.method!='GET'||new URL(r.url).origin!=location.origin)return;
 // 'no-cache' = always check with the server, so the files can never be a mix of old and new versions
 e.respondWith(fetch(r,{cache:'no-cache'}).then(x=>{const c=x.clone();caches.open(C).then(k=>k.put(r,c));return x}).catch(()=>caches.match(r).then(x=>x||caches.match('index.html'))));
});
