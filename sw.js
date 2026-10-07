// Network first (so updates arrive automatically), cache fallback (so it works offline)
const C='notes';
addEventListener('install',e=>{skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.json','icon.png'])))});
addEventListener('activate',e=>e.waitUntil(clients.claim()));
addEventListener('fetch',e=>{
 const r=e.request;
 if(r.method!='GET'||new URL(r.url).origin!=location.origin)return;
 e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(C).then(k=>k.put(r,c));return x}).catch(()=>caches.match(r).then(x=>x||caches.match('index.html'))));
});
