// calendar.js — calendar views, tasks, the time dial, task form, links between tasks and To-Do notes.
// Needs: core.js; calls into notes.js (draw, leave) and app.js (ask, menu)
// Loaded 3rd (plain <script> tags in index.html share one global scope; order matters).

// ---- Calendar & tasks. One record per day: {id,d:'YYYY-MM-DD',s:'HH:MM',e,b:title,z:done,g:series id} ----
const days='Mon Tue Wed Thu Fri Sat Sun'.split(' ');
const TD=s=>D.t.filter(x=>!x.x&&x.d==s).sort((a,b)=>a.s<b.s?-1:a.s>b.s?1:0);
const curT=()=>TD(cd)[ti];
function drawC(){
 const td=iso(new Date()),T=TD(cd),M=dt(cd),wd=(M.getDay()+6)%7;
 ti=Math.max(0,Math.min(ti,T.length-1));
 const ttl=cv=='m'?M.toLocaleDateString(undefined,{month:'long',year:'numeric'}):cv=='w'?'Week of '+dt(addD(cd,-wd)).toLocaleDateString(undefined,{day:'numeric',month:'short'}):M.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
 let h=`<div class="tb"><button data-a="-1">‹</button><b>${ttl}</b><button data-a="1">›</button>${[...'mwd'].map(v=>`<button data-v="${v}"${v==cv?' class="s"':''}>${v.toUpperCase()}</button>`).join('')}</div>`;
 if(cv=='m'){
  const st=addD(cd.slice(0,8)+'01',-((new Date(M.getFullYear(),M.getMonth(),1).getDay()+6)%7));
  h+='<div class="wk">'+days.map(x=>`<b>${x}</b>`).join('')+'</div><div class="mg">';
  for(let i=0;i<42;i++){
   const s=addD(st,i),a=TD(s);
   h+=`<div class="dc${s==cd?' s':''}${s==td?' td':''}${s.slice(0,7)!=cd.slice(0,7)?' o':''}" data-d="${s}"><span>${+s.slice(8)}</span>${a.slice(0,3).map(x=>`<i${x.z?' class="dn"':''}>${esc(x.b)}</i>`).join('')}${a.length>3?`<i>+${a.length-3}</i>`:''}</div>`;
  }
  h+='</div>';
 }else if(cv=='w'){
  h+='<div class="wg">'+days.map((n,i)=>{const s=addD(cd,i-wd);return `<div class="wc${s==cd?' s':''}" data-d="${s}"><h4>${n} ${+s.slice(8)}</h4>${TD(s).map((x,j)=>`<div class="tk${x.z?' dn':''}${s==cd&&j==ti?' s':''}" data-t="${x.id}">${x.s} ${esc(x.b)}</div>`).join('')}</div>`}).join('')+'</div>';
 }else h+=T.length?T.map((x,j)=>`<div class="tk${x.z?' dn':''}${j==ti?' s':''}" data-t="${x.id}"><b>${x.s}–${x.e}${x.ed?' +1':''}</b>${esc(x.b)}</div>`).join(''):'<div class="h" style="padding:12px">No tasks. Press n to add one.</div>';
 $('#V').innerHTML=h;$('#V').classList.toggle('f',mode=='s'&&cf);
}
const go=(n,big)=>{cd=big&&cv=='m'?addM(cd,n):addD(cd,big&&cv=='w'?7*n:n);ti=0;drawC()};
const setV=v=>{cv=v;drawC()};
let ft,dm; // task form: ft={s,e,n:end is next day,et:end picked by hand}, dm=open dial {w:'s'|'e',st:'h'|'m'}
const pad=n=>String(n).padStart(2,'0'),tmin=h=>+h.slice(0,2)*60+ +h.slice(3),tstr=n=>pad(n/60|0)+':'+pad(n%60);
const head=x=>x.s+' '+x.b; // a task's note starts with 'HH:MM title'
function retitle(n,h){const i=n.b.indexOf('\n');n.b=h+(i<0?'':n.b.slice(i));n.t=n.u=Date.now()}
function fixHead(x,oh){if(head(x)==oh)return;const n=D.n.find(n=>n.k==x.id&&!n.x);n&&retitle(n,head(x))}
function shift(d){
 const x=curT();if(!x||cv!='d')return;
 const a=tmin(x.s),b=tmin(x.e)+(x.ed?1440:0),oh=head(x),
 k=Math.max(-a,Math.min(x.ed?Math.min(1439-a,2879-b):1439-b,d*15)),b2=b+k;
 x.s=tstr(a+k);x.e=tstr(b2%1440);b2>=1440?x.ed=addD(x.d,1):delete x.ed;
 x.t=Date.now();fixHead(x,oh);save();ti=TD(cd).indexOf(x);draw();
}
function toggleDone(){const x=curT();if(x){x.z=x.z?0:1;x.t=Date.now();save();draw()}}
function delTask(){
 const x=curT();if(!x)return;
 const all=x.g?D.t.filter(y=>!y.x&&y.g==x.g):[];
 if(all.length<2)return ask(`Delete task “${x.b}” (${x.s})? type y`,v=>{if(v=='y'){x.x=1;x.t=Date.now();save();draw()}});
 ask(`Delete “${x.b}”: y = this day only, a = all ${all.length} repeats`,v=>{
  v=v.toLowerCase();if(v!='y'&&v!='a')return;
  const T=Date.now();(v=='a'?all:[x]).forEach(y=>{y.x=1;y.t=T});
  if(v=='a')D.n.forEach(n=>{if(!n.x&&all.some(y=>y.id==n.k)){n.x=1;n.t=T}});
  save();draw();
 });
}
function newTask(){taskForm()}
function editTask(){const x=curT();x?taskForm(x):newTask()}
const O2=$('#o2'),closeF=()=>{ov=null;dm=null;O2.hidden=1;draw()};
const now=()=>{const d=new Date();return iso(d)+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
// ---- To-Do folder: one note per task (per day), listed day by day for today + the next 6 days ----
const wnd=()=>{const a=iso(new Date());return [a,addD(a,6)]};
const taskOf=n=>n.k&&D.t.find(x=>x.id==n.k);
// shown in To-Do: your own notes; task notes for the next 7 days while the task is open (not done / deleted),
// or any task note while the calendar is open on its date
function vis(n){
 if(!n.k)return true;const x=taskOf(n);if(!x)return false;const [a,b]=wnd();
 return !x.x&&!x.z&&x.d>=a&&x.d<=b||mode!='n'&&x.d==cd;
}
function todoList(){
 const k=n=>{const x=taskOf(n);return x?x.d+x.s:'9'+n.o};
 return D.n.filter(n=>n.f=='todo'&&!n.x&&vis(n)).sort((p,q)=>k(p)<k(q)?-1:1);
}
function todoRows(n,s,rowH){ // day headers + the notes of that day
 const [a]=wnd(),set=new Set(Array.from({length:7},(_,i)=>addD(a,i)));
 n.forEach(x=>{const t=taskOf(x);t&&set.add(t.d)});
 const lab=d=>{const x=dt(d);return days[(x.getDay()+6)%7]+' ('+x.getDate()+' '+x.toLocaleDateString(undefined,{month:'short'})+')'+(d==a?' · today':'')};
 let h='';
 [...set].sort().forEach(d=>{h+=`<div class="dh">${lab(d)}</div>`;n.forEach((x,i)=>{const t=taskOf(x);if(t&&t.d==d)h+=rowH(x,1,i,s)})});
 const own=n.map((x,i)=>[x,i]).filter(([x])=>!taskOf(x));
 return h+(own.length?'<div class="dh">Other</div>'+own.map(([x,i])=>rowH(x,1,i,s)).join(''):'');
}
function mkNote(x){ // fixed id per task, so two devices never create two notes for the same task
 const n={id:'t_'+x.id,f:'todo',k:x.id,o:Date.now(),t:Date.now(),u:Date.now(),b:head(x)+'\n'};D.n.push(n);save();return n;
}
function syncTodo(){
 const [a,b]=wnd();let c=0;
 D.n.forEach(n=>{ // notes made for a whole series (older versions): move to the series' first day
  if(n.k&&!n.x&&!D.t.some(x=>x.id==n.k)){
   const y=D.t.filter(x=>x.g==n.k&&!x.x).sort((p,q)=>p.d<q.d?-1:1)[0];
   if(y&&!D.n.some(m=>m.k==y.id)){n.k=y.id;n.t=Date.now();c=1}
  }
 });
 D.t.forEach(x=>{if(!x.x&&x.d>=a&&x.d<=b&&!D.n.some(n=>n.k==x.id))mkNote(x)});
 c&&save();
}
function ensureNote(x){
 const n=D.n.find(n=>n.k==x.id);
 if(n&&n.x){delete n.x;n.t=Date.now()}
 return n||mkNote(x);
}
function openNote(x){
 const n=ensureNote(x);cd=x.d;mode='s';sd='l';cf=0;fi=0;pane=2;ni=Math.max(0,N().indexOf(n));draw();
 E.focus();E.setSelectionRange(E.value.length,E.value.length);
}
const ndm=()=>tmin(ft.s)>=1425; // start 23:45 or later: every end option falls on the next day
const okT=(h,q)=>dm.w=='s'||ndm()||h*60+q>tmin(ft.s); // end must come after start
function endTo(a){ft.n=a>=1440?1:0;ft.e=tstr(a%1440)}
function setStart(v){ft.s=v;const S=tmin(v);if(!ft.et||ft.n&&S<1425||tmin(ft.e)+(ft.n?1440:0)<=S)endTo(S+15)}
function fchips(){
 $('#fs').textContent=ft.s;$('#fe').textContent=ft.e+(ft.n?' +1':'');
 $('#fs').classList.toggle('on',!!dm&&dm.w=='s');$('#fe').classList.toggle('on',!!dm&&dm.w=='e');
}
function dial(){
 fchips();const P=$('#dl');P.hidden=!dm;if(!dm)return;
 const v=dm.w=='s'?ft.s:ft.e,h=+v.slice(0,2),m=+v.slice(3);
 const bt=(r,a,val,lab,on,dis,c)=>`<button class="dk ${c}${on?' on':''}" data-v="${val}" style="left:${50+r*Math.sin(a)}%;top:${50-r*Math.cos(a)}%"${dis?' disabled':''}>${lab}</button>`;
 let b='';
 if(dm.st=='h')for(let i=0;i<12;i++){ // inner ring 1–12, outer ring 13–23 (+00 at the top)
  const a=i*Math.PI/6,o=i?12+i:0,n=i||12;
  b+=bt(27,a,n,n,h==n,!okT(n,45),'')+bt(42,a,o,pad(o),h==o,!okT(o,45),'');
 }else[[0,'00'],[15,'15'],[30,'30'],[45,'45']].forEach(([q,l])=>b+=bt(34,q*Math.PI/30,q,l,m==q,!okT(h,q),'q'));
 P.innerHTML=`<div class="dial">${b}<div class="dr"><small>${dm.w=='s'?'Start':ndm()?'End · next day':'End'}</small><div><span data-s="h"${dm.st=='h'?' class="on"':''}>${pad(h)}</span>:<span data-s="m"${dm.st=='m'?' class="on"':''}>${pad(m)}</span></div></div></div>`;
}
function pick(v){
 const w=dm.w,x=w=='s'?ft.s:ft.e,hr=dm.st=='h';let h=+x.slice(0,2),m=+x.slice(3);
 if(hr){h=v;if(!okT(h,m))m=[0,15,30,45].find(q=>okT(h,q));dm.st='m'}else m=v;
 const nv=pad(h)+':'+pad(m);
 if(w=='s'){if(hr)ft.s=nv;else setStart(nv)}else{ft.e=nv;ft.n=ndm()?1:0;ft.et=1}
 if(!hr)dm=null;
 dial();
}
function dclick(ev){
 const s=ev.target.closest('[data-s]'),b=ev.target.closest('[data-v]');
 if(s){dm.st=s.dataset.s;return dial()}
 if(b)return b.disabled||pick(+b.dataset.v);
 if(dm.st=='m'){ // tap between the four minute options: snap to the nearest
  const r=ev.currentTarget.querySelector('.dial').getBoundingClientRect(),
  a=(Math.atan2(ev.clientX-r.left-r.width/2,r.top+r.height/2-ev.clientY)*180/Math.PI+360)%360,
  q=[0,15,30,45][Math.round(a/90)%4],h=+(dm.w=='s'?ft.s:ft.e).slice(0,2);
  okT(h,q)&&pick(q);
 }
}
function taskForm(t){
 ov={form:1};
 const s=t?t.s:'09:00';
 ft={s,e:t?t.e:tstr(tmin(s)+15),n:t&&t.ed?1:0,et:t?1:0};dm=null;
 $('#o2>div').innerHTML=`<input id="fb" placeholder="Task" value="${t?esc(t.b):''}">
 <div class="r"><input id="fd" type="date" value="${t?t.d:cd}" style="flex:1"></div>
 <div class="r"><button class="tc" id="fs"></button><span>–</span><button class="tc" id="fe"></button></div>
 <div id="dl" hidden></div>
 <button class="bt" id="fr">Repeats?</button>
 <div id="rp" hidden><div class="r">${days.map((n,i)=>`<button class="bt" data-w="${i}">${n}</button>`).join('')}</div>
  <div class="r" style="margin-top:8px"><span>Repeat for</span><input id="fw" type="number" min="1" max="52" value="1" style="width:70px"><span>weeks</span></div></div>
 <div class="r"><button id="fk">Save</button><button id="fm">Details</button><button id="fx">Cancel</button></div>`;
 const B=[...document.querySelectorAll('#rp [data-w]')];
 B[(dt(t?t.d:cd).getDay()+6)%7].classList.add('on');
 B.forEach(b=>b.onclick=()=>b.classList.toggle('on'));
 $('#fr').onclick=()=>{$('#fr').classList.toggle('on');$('#rp').hidden=!$('#fr').classList.contains('on')};
 $('#fs').onclick=()=>{dm=dm&&dm.w=='s'?null:{w:'s',st:'h'};dial()};
 $('#fe').onclick=()=>{dm=dm&&dm.w=='e'?null:{w:'e',st:'h'};dial()};
 $('#dl').onclick=dclick;
 $('#fx').onclick=closeF;$('#fk').onclick=()=>saveTask(t);$('#fm').onclick=()=>saveTask(t,1);
 fchips();O2.hidden=0;$('#fb').focus();
}
function saveTask(t,det){
 const b=$('#fb').value.trim(),d=$('#fd').value,s=ft.s;
 if(!b||!d)return $('#fb').focus();
 if(tmin(ft.e)+(ft.n?1440:0)<=tmin(s))endTo(tmin(s)+15); // never end before start
 const e=ft.e,nx=ft.n,ex=x=>nx?{ed:addD(x,1)}:{};
 const W=$('#fr').classList.contains('on')?[...document.querySelectorAll('#rp .on')].map(x=>+x.dataset.w):[];
 let g=W.length?uid():0,first;
 if(t){
  const oh=head(t),n=D.n.find(n=>n.k==t.id&&!n.x); // note title follows task title + start time
  if(g){t.g=t.g||g;g=t.g}
  Object.assign(t,{b,d,s,e,t:Date.now()});nx?t.ed=addD(d,1):delete t.ed;first=t;
  if(n&&head(t)!=oh)retitle(n,head(t));
 }else if(!g)first=add(D.t,{b,d,s,e,...ex(d)});
 if(g){
  const end=addD(d,7*Math.max(1,Math.min(52,+$('#fw').value||1))-1);
  for(let x=d;x<=end;x=addD(x,1)){
   if(!W.includes((dt(x).getDay()+6)%7)||t&&x==d)continue;
   const y=add(D.t,{b,g,d:x,s,e,...ex(x)});first=first||y;
  }
 }
 save();cd=first.d;ti=Math.max(0,TD(cd).indexOf(first));ov=null;dm=null;O2.hidden=1;
 det?openNote(first):draw();
}
O2.onkeydown=ev=>{if(ev.key=='Escape'){ev.stopPropagation();dm?(dm=null,dial()):closeF()}else if(ev.key=='Enter'&&ev.target.tagName!='BUTTON'){ev.stopPropagation();ev.preventDefault();$('#fk').click()}}; // Enter on a button presses that button; in a field it saves
O2.onclick=ev=>{if(ev.target==O2)closeF()};
function calKey(ev){
 const k=ev.key=='Backspace'?'Delete':ev.key;
 if(k=='Escape'||k=='?'){ev.preventDefault();return menu()}
 if(ev.ctrlKey||ev.metaKey)return;
 if(ev.altKey&&(k=='ArrowUp'||k=='ArrowDown')){ev.preventDefault();return shift(k=='ArrowUp'?-1:1)}
 if(k=='ArrowLeft'||k=='ArrowRight'){ev.preventDefault();return go(k=='ArrowLeft'?-1:1)}
 if(k=='ArrowUp'||k=='ArrowDown'){ev.preventDefault();const u=k=='ArrowUp'?-1:1;return cv=='d'?(ti+=u,drawC()):go(7*u)}
 if(k=='['||k==']'){ev.preventDefault();return go(k=='['?-1:1,1)}
 if(k=='Enter'){ev.preventDefault();return cv=='d'?editTask():setV('d')}
 if(k=='d'&&cv=='d'&&curT()){ev.preventDefault();return delTask()} // in day view with a task selected, d deletes it
 const c=C.find(c=>c[0]==k&&c[3]!='n');if(c){ev.preventDefault();c[2]()}
}
// ---- Calendar clicks / swipes ----
$('#V').onclick=ev=>{
 cf=1;
 const b=ev.target.closest('[data-a],[data-v],[data-t],[data-d]');if(!b)return draw();
 const a=b.dataset;
 if(a.a)go(+a.a,1);
 else if(a.v)setV(a.v);
 else if(a.t){const x=D.t.find(y=>y.id==a.t);cd=x.d;ti=TD(cd).indexOf(x);drawC()}
 else{const same=cd==a.d;cd=a.d;ti=0;if(cv!='d'&&(same||matchMedia('(hover:none)').matches))cv='d';drawC()}
};
$('#V').ondblclick=ev=>ev.target.closest('[data-t]')?editTask():ev.target.closest('.dc,.wc')&&newTask();
let sx;$('#V').ontouchstart=e=>sx=e.touches[0].clientX;
$('#V').ontouchend=e=>{const d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>70)go(d<0?1:-1,1)};
