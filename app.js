// app.js — shortcut list, menu and prompts, keyboard routing, view switching, startup.
// Needs: all the other files
// Loaded last (plain <script> tags in index.html share one global scope; order matters).

// ---- COMMANDS: [key, label, action]. Menu (Esc) lists these. ----
const C=[ // [key, label, action, scope: n=notes, c=calendar, none=general]
 ['Esc','Show / hide this list',()=>0],
 ['s','Sync / connect Drive',()=>{L.link=1;sync()}],
 ['Tab+Enter','Switch Notes / Calendar (from split view: opens the left side)',swap],
 ['Tab+Left','Split view, calendar on left / move focus left',()=>split('l')],
 ['Tab+Right','Split view, calendar on right / move focus right',()=>split('r')],
 ['Tab','In split view: switch which side has the cursor',()=>0],
 ['Shift+T','Next theme',()=>setTh((+L.th||0)+1)],
 ['Up / Down','Move through folders / notes',()=>0,'n'],
 ['Right / Enter','Open folder / note',()=>0,'n'],
 ['Left','Go back',()=>0,'n'],
 ['n','New note',newNote,'n'],
 ['f','New folder',newFolder,'n'],
 ['r','Rename folder',rename,'n'],
 ['d','Delete selected folder / note (asks first)',del,'n'],
 ['Alt+Up','Move up in order',()=>move(-1),'n'],
 ['Alt+Down','Move down in order',()=>move(1),'n'],
 ['Left / Right','Previous / next day',()=>0,'c'],
 ['Up / Down','Week up / down (pick task in day view)',()=>0,'c'],
 ['[ and ]','Previous / next month, week or day',()=>0,'c'],
 ['Enter','Open day / edit task',()=>0,'c'],
 ['n','New task',newTask,'c'],
 ['e','Edit task',editTask,'c'],
 ['o','Task details (opens its note)',()=>{const x=curT();x&&openNote(x)},'c'],
 ['x','Done / not done',toggleDone,'c'],
 ['Delete','Delete task',delTask,'c'],
 ['Alt+Up','Shift task 15 min earlier',()=>shift(-1),'c'],
 ['Alt+Down','Shift task 15 min later',()=>shift(1),'c'],
 ['m','Month view',()=>setV('m'),'c'],
 ['w','Week view',()=>setV('w'),'c'],
 ['d','Day view',()=>setV('d'),'c'],
 ['d','In day view: delete the selected task',()=>0,'c'],
 ['t','Jump to today',()=>{cd=iso(new Date());ti=0;drawC()},'c'],
 ...TH.map((t,i)=>['','Theme: '+t[0],()=>setTh(i),'th']) // always last
];
// ---- Popup: menu (Esc) and text prompts ----
const order=()=>[...(mode=='c'||mode=='s'&&sd=='l'?['','c','n']:['','n','c']),'th']; // general first, then the section on the left, themes last
const items=()=>{const q=Q.value.toLowerCase(),o=order();return C.filter(c=>c[1].toLowerCase().includes(q)).sort((a,b)=>o.indexOf(a[3]||'')-o.indexOf(b[3]||''))};
function run(c){const k=c[3];if(k=='n'||k=='c'){if(mode=='s')cf=k=='c';else mode=k=='c'?'c':'n'}c[2]();draw()}
function ml(){
 let g;const H={'':'General',n:'Notes',c:'Calendar',th:'Themes'};
 LS.innerHTML=items().map((c,i)=>{const k=c[3]||'',h=k!=g?(g=k,`<div class="hd">${H[k]}</div>`):'';return h+`<div class="i${i==ov.i?' s':''}" data-c="${i}"><b>${c[0]}</b>${c[1]}</div>`}).join('');
 const e=LS.querySelector('.s');e&&e.scrollIntoView({block:'nearest'});
}
function ask(label,fn,v=''){ov={fn};Q.placeholder=label;Q.value=v;LS.innerHTML='';O.hidden=0;Q.focus()}
function menu(){ov={m:1,i:0};Q.placeholder='Command…';Q.value='';O.hidden=0;Q.focus();ml()}
function close(){ov=null;O.hidden=1;Q.blur()}
Q.onkeydown=ev=>{
 const k=ev.key,n=items().length;
 if(k=='Escape')return close();
 if(k=='Enter'){ev.preventDefault();const m=ov,v=Q.value.trim(),c=items()[m.i];close();return m.fn?v&&m.fn(v):c&&run(c)}
 if(!ov.fn&&n&&(k=='ArrowDown'||k=='ArrowUp')){ev.preventDefault();ov.i=(ov.i+(k=='ArrowDown'?1:-1)+n)%n;ml()}
};
Q.oninput=()=>{if(ov.m){ov.i=0;ml()}};
LS.onclick=ev=>{const el=ev.target.closest('[data-c]');if(el){const c=items()[+el.dataset.c];close();run(c)}};
O.onclick=ev=>{if(ev.target==O)close()};

// ---- View switching (notes / calendar / split) ----
function setMode(m){leave();mode=m;draw()}
function swap(){if(mode=='s'){mode=sd=='l'?'c':'n';draw()}else setMode(mode=='n'?'c':'n')}
function split(s){if(mode=='s'){cf=sd==s;draw()}else{leave();cf=mode=='n';mode='s';sd=s;draw()}}
// ---- Keyboard: routes keys to notesKey (notes.js) or calKey (calendar.js) ----
onkeydown=ev=>{
 const k=ev.key;
 if(ov||ev.target==Q)return;
 if(k=='Tab'){ev.preventDefault();if(!tab)tab=1;return} // tab: 1 = pressed alone, 2 = used in a Tab+key shortcut
 if(k=='T'&&ev.shiftKey&&!ev.ctrlKey&&!ev.metaKey&&!ev.altKey&&ev.target!=E&&ev.target!=ET&&!tab){ev.preventDefault();return setTh((+L.th||0)+1)}
 if(tab){ev.preventDefault();tab=2;if(!ev.repeat){if(k=='Enter')swap();if(k=='ArrowLeft')split('l');if(k=='ArrowRight')split('r')}return}
 if(cal())return calKey(ev);
 notesKey(ev);
};

// ---- Header buttons, bottom bar, Tab tracking ----
$('#bk').onclick=back;$('#mn').onclick=menu;
$('#ad').onclick=()=>cal()?newTask():pane?newNote():newFolder();
$('#up').onclick=()=>cal()?shift(-1):move(-1);$('#dn').onclick=()=>cal()?shift(1):move(1);
$('#st').onclick=()=>{L.link=1;sync()};
document.querySelectorAll('#nv button').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
addEventListener('keyup',ev=>{if(ev.key=='Tab'){if(tab==1&&mode=='s'&&!ov){cf=!cf;draw()} tab=0}}); // Tab alone in split view = switch side
addEventListener('blur',()=>tab=0);

// ---- Start ----
fi=Math.min(1,F().length-1);setTh(+L.th||0);draw();setSt(L.link?'◐':'○');sync();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
navigator.storage&&navigator.storage.persist&&navigator.storage.persist();
