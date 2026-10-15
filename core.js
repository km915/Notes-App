// core.js — settings, themes, small helpers, the data and the shared state.
// Needs: nothing (loads first)
// Loaded 1st (plain <script> tags in index.html share one global scope; order matters).

// ---- CONFIG: paste your Google OAuth Client ID here ----
const CID='58518608488-05qgos3pv2n23l76617aou61f46ihdlf.apps.googleusercontent.com';
const SCOPE='https://www.googleapis.com/auth/drive.file';

// ---- THEMES: [name, notes colours, calendar colours], each [bg,panel,text,dim,accent,selected] — add more here ----
const TH=[
 ['Midnight',['#0b1220','#111a2e','#d8dee9','#7b88a1','#88c0d0','#1c2a47'],['#12203a','#1a2b4d','#e6ecf5','#8fa0bd','#8fd0e6','#26406b']],
 ['Gruvbox',['#2b2118','#342920','#ebdbb2','#a89984','#fabd2f','#4a3a2a'],['#3a2c1e','#46362a','#f2e5c0','#b8a78c','#ffc83d','#5c4733']],
 ['Forest',['#0d1a14','#12241b','#d5e5da','#7f9a8a','#7fd1a0','#1d3a2b'],['#15291f','#1c3a2c','#e2f1e7','#8fb09b','#8fe3b0','#2a5a41']],
 ['Dusk',['#150f1f','#1d1530','#e3dcf0','#8f84a8','#c3a6ff','#2d2150'],['#1f1630','#2a1f45','#efe8fb','#a094bd','#d2b8ff','#3d2d6b']]
];

// ---- DATA: {f:[folders],n:[notes]}; item = {id,o:order,t:edited,x:deleted,...} ----
const $=s=>document.querySelector(s),L=localStorage,E=$('#E'),Q=$('#q'),O=$('#o'),LS=$('#ls');
const iso=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
const dt=s=>new Date(s+'T00:00');
const addD=(s,n)=>{const x=dt(s);x.setDate(x.getDate()+n);return iso(x)};
const addM=(s,n)=>{const x=dt(s),k=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(k,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return iso(x)};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>s.replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
let D=JSON.parse(L.d||'{"f":[],"n":[]}'),fi=0,ni=0,pane=0,shown,ov,tok=L.tk,tm,busy,again,hl=history.state&&history.state.p||0;
if(!D.f.length)D.f.push({id:'d',name:'Notes',o:1,t:1});
D.t=D.t||[];
if(!D.f.some(f=>f.id=='todo'))D.f.push({id:'todo',name:'To-Do',o:0,t:1}); // always-first folder for task notes
let mode='n',sd='r',cf=0,cv='m',cd=iso(new Date()),ti=0,tab; // mode: n notes, c calendar, s split (calendar on side sd, cf = calendar has focus)
const cal=()=>mode=='c'||mode=='s'&&cf;
const live=a=>a.filter(x=>!x.x).sort((a,b)=>a.o-b.o);
const F=()=>live(D.f).sort((a,b)=>(b.id=='todo')-(a.id=='todo')),N=()=>F()[fi]?live(D.n.filter(n=>n.f==F()[fi].id&&(n.f!='todo'||vis(n)))):[];
const cur=()=>pane?N()[ni]:F()[fi];
const save=()=>{L.d=JSON.stringify(D);clearTimeout(tm);tm=setTimeout(sync,2000)};
const add=(a,o)=>{const x={id:uid(),o:Date.now(),t:Date.now(),...o};a.push(x);save();return x};

// ---- Applying the theme (calendar uses its own, brighter palette) ----
const VN=['bg','pn','tx','dm','ac','se'];
function applyTh(){ // calendar has its own (brighter) palette
 const t=TH[+L.th||0],c=mode=='c'?t[2]:t[1];
 c.forEach((x,j)=>document.documentElement.style.setProperty('--'+VN[j],x));
 t[2].forEach((x,j)=>$('#V').style.setProperty('--'+VN[j],x));
 $('[name=theme-color]').content=c[0];
}
function setTh(i){L.th=(i+TH.length)%TH.length;applyTh()}

