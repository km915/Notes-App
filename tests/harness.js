// harness.js — serves the repo's web files on a local port and opens them in jsdom (a pretend browser).
// load({phone, fetch, cap, ls}) -> {win, errs, nav, g, close}
//   phone: pretend the screen is touch-only      fetch: fake network (jsdom has none)
//   cap(win): returns a fake window.Capacitor (the Android app)      ls: values to put in localStorage first
const http=require('http'),fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const ROOT=path.join(__dirname,'..');
const TYPES={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png'};
exports.wait=ms=>new Promise(k=>setTimeout(k,ms));
exports.load=async(o={})=>{
 const srv=http.createServer((q,r)=>{
  const p=q.url.split('?')[0],f=path.join(ROOT,p=='/'?'index.html':p);
  fs.readFile(f,(e,d)=>{if(e){r.statusCode=404;return r.end()}r.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');r.end(d)});
 });
 await new Promise(k=>srv.listen(0,k));
 const errs=[],nav=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>(/navigation/i.test(e.message)?nav:errs).push(e.message)); // a page leaving (location.assign) is recorded, not an error
 const dom=await JSDOM.fromURL('http://localhost:'+srv.address().port+'/',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.Element.prototype.scrollIntoView=()=>{};
  w.matchMedia=q=>({matches:o.phone?q.includes('hover:none'):q.includes('hover:hover'),media:q,addEventListener(){},removeEventListener(){}});
  w.vibes=[];w.navigator.vibrate=n=>{w.vibes.push(n);return true};
  for(const k in o.ls||{})w.localStorage[k]=o.ls[k];
  if(o.fetch)w.fetch=o.fetch;
  if(o.cap)w.Capacitor=o.cap(w);
  w.addEventListener('error',e=>errs.push(e.message));
 }});
 await exports.wait(o.settle||400);
 const win=dom.window;
 return {win,errs,nav,g:s=>win.eval(s),close:()=>{win.close();srv.close()}};
};
// a fake network reply
exports.reply=(status,body,type='application/json')=>({status,ok:status>=200&&status<300,headers:{get:h=>h.toLowerCase()=='content-type'?type:null},json:async()=>typeof body=='string'?JSON.parse(body):body,text:async()=>typeof body=='string'?body:JSON.stringify(body)});
// pointer / key helpers
exports.tools=win=>({
 ptr:(el,t,x=10,y=10,type='touch')=>{const e=new win.MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerType',{value:type});el.dispatchEvent(e)},
 click:el=>el.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true})),
 key:(el,k,o={})=>el.dispatchEvent(new win.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:k,...o})),
 type:(el,v)=>{el.value=v;el.dispatchEvent(new win.Event('input',{bubbles:true}))}
});
