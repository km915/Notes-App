// notes.js — folders and notes: drawing the lists, ordering, keys, clicks, column resizing.
// Needs: core.js; calls into calendar.js (vis, drawC) and app.js (menu, ask)
// Loaded 2nd (plain <script> tags in index.html share one global scope; order matters).

// ---- UI ----
const fit=()=>{ET.style.height='auto';if(ET.scrollHeight)ET.style.height=ET.scrollHeight+'px'}; // title box grows with its text
const stamp=ms=>{const d=new Date(ms);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+' - '+d.getDate()+' '+d.toLocaleDateString(undefined,{month:'short'})};
const rowH=(x,k,i,s)=>`<div class="i${i==s?' s':''}${!k&&x.id=='todo'?' td':''}" data-k="${k}" data-i="${i}">${esc(k?(x.b.split('\n')[0]||'Empty note'):x.name)}</div>`;
function draw(){
 syncTodo(); // every task of the next 7 days gets its To-Do note
 if(!F().length)add(D.f,{name:'Notes'});
 fi=Math.max(0,Math.min(fi,F().length-1));ni=Math.max(0,Math.min(ni,N().length-1)); // clamp first, then read the lists
 const f=F(),n=N();
 const row=(a,k,s)=>a.map((x,i)=>rowH(x,k,i,s)).join('');
 $('#P0').innerHTML=row(f,0,fi);
 $('#P1').innerHTML=f[fi].id=='todo'?todoRows(n,ni,rowH):n.length?row(n,1,ni):'<div class="i h">Tap + (or press n) for a new note</div>';
 [0,1,2].forEach(i=>$('#P'+i).classList.toggle('on',i==pane));
 const x=N()[ni],ae=document.activeElement,typing=ae==E||ae==ET;
 if(!x)E.value=ET.value='';
 else if(shown!=x.id||!typing){const i=x.b.indexOf('\n');ET.value=i<0?x.b:x.b.slice(0,i);E.value=i<0?'':x.b.slice(i+1)} // first line = title box
 shown=x&&x.id;E.disabled=ET.disabled=!x;fit();
 $('#le').textContent=x?'last edited: '+stamp(x.u||x.t):'';
 $('#t').textContent=mode=='c'?'Calendar':pane?f[fi].name:'Folders';
 const cs=pane==1?f.map(x=>x.name):pane==2?n.map(x=>x.b.split('\n')[0]||'Empty'):[],ci=pane==1?fi:ni;
 $('#ch').className=pane?'v':'';
 $('#ch').innerHTML=cs.map((x,i)=>`<span class="${i==ci?'s ':''}${pane==1&&f[i].id=='todo'?'td':''}" data-i="${i}">${esc(x.length>9?x.slice(0,9)+'…':x)}</span>`).join('');
 const sc=$('#ch .s');sc&&sc.scrollIntoView({inline:'center',block:'nearest'});
 if(!ov){if(pane==2&&!cal()){if(!typing)(x&&!ET.value?ET:E).focus()}else{E.blur();ET.blur()}}
 $('main').className=mode=='n'?'n':mode=='c'?'c':'s'+sd;
 document.querySelectorAll('#nv button').forEach(b=>b.classList.toggle('s',b.dataset.m==(mode=='c'?'c':'n')));
 applyTh();
 if(mode!='n')drawC();
 // keep phone back button working: one history entry per level
 if(pane>hl){history.pushState({p:pane},'');hl=pane}else if(pane<hl){const k=hl-pane;hl=pane;history.go(-k)}
}
function leave(){const x=N()[ni];if(pane==2&&x&&!x.b.trim()){x.x=1;x.t=Date.now();save()}}
function back(){if(cal()){cv=cv=='d'?'w':'m';return drawC()}leave();pane=Math.max(0,pane-1);draw()}
function move(d){
 const a=pane?N():F(),i=pane?ni:fi,b=a[i+d];if(!b)return;
 if(pane&&F()[fi].id=='todo')return toast('To-Do notes are sorted by day and time');
 if(a[i].id=='todo'||b.id=='todo')return toast('The To-Do folder always stays on top');
 [a[i].o,b.o]=[b.o,a[i].o];a[i].t=b.t=Date.now();
 pane?ni+=d:fi+=d;save();draw();
}
function newNote(){const f=F()[fi];add(D.n,{f:f.id,b:''});ni=N().length-1;pane=2;draw()}
function newFolder(){ask('Folder name',v=>{add(D.f,{name:v});fi=F().length-1;ni=0;pane=1;draw()})}
function rename(){const f=F()[fi];if(f.id=='todo')return toast("The To-Do folder can't be renamed");ask('Rename folder',v=>{f.name=v;f.t=Date.now();save();draw()},f.name)}
function del(){
 const x=cur();if(!x)return;
 if(x.id=='todo')return toast("The To-Do folder can't be deleted");
 const tk=pane&&x.k&&D.t.find(y=>y.id==x.k&&!y.x);
 if(tk)return delTaskOf(tk,matchMedia('(hover:none)').matches); // a To-Do note: deleting it deletes its task too
 const nn=pane?0:D.n.filter(n=>n.f==x.id&&!n.x).length; // say exactly what will go
 ask(pane?`Delete note “${x.b.split('\n')[0]||'Empty note'}”? type y`:`Delete folder “${x.name}”${nn?` and its ${nn} note${nn>1?'s':''}`:''}? type y`,v=>{
  if(v!='y')return;
  x.x=1;x.t=Date.now();
  if(!pane)D.n.forEach(n=>{if(n.f==x.id){n.x=1;n.t=x.t}});
  pane?ni--:fi--;pane=pane?1:0;save();draw();
 });
}

function notesKey(ev){ // keys while the notes side has focus
 const k=ev.key;
 if(ev.target==E||ev.target==ET){if(k=='Escape'){ev.preventDefault();leave();pane=1;draw()}return}
 if(ev.ctrlKey||ev.metaKey)return;
 if(k=='Escape'||k=='?'){ev.preventDefault();return menu()}
 if(ev.altKey){ev.preventDefault();if(k=='ArrowUp')move(-1);if(k=='ArrowDown')move(1);return}
 const d={ArrowDown:1,j:1,ArrowUp:-1,k:-1}[k];
 if(d){ev.preventDefault();pane?ni+=d:(fi+=d,ni=0);return draw()}
 if(k=='ArrowRight'||k=='l'||k=='Enter'){ev.preventDefault();pane=Math.min(pane+1,2);if(pane==2&&!N()[ni])pane=1;return draw()}
 if(k=='ArrowLeft'||k=='h'){ev.preventDefault();return back()}
 const c=C.find(c=>c[0]==k&&c[3]!='c');if(c){ev.preventDefault();c[2]()}
}

// ---- Clicks / typing ----
const ed=()=>{const x=N()[ni];if(!x)return;x.b=ET.value.replace(/\n/g,' ')+'\n'+E.value;x.t=x.u=Date.now();save();draw()}; // u = last edited (content only)
E.oninput=ET.oninput=ed;
ET.onkeydown=ev=>{if(ev.key=='Enter'){ev.preventDefault();E.focus();E.setSelectionRange(0,0)}};
E.onkeydown=ev=>{if((ev.key=='Backspace'||ev.key=='ArrowUp')&&!E.selectionStart&&!E.selectionEnd&&!ev.shiftKey){ev.preventDefault();ET.focus();ET.setSelectionRange(ET.value.length,ET.value.length)}};
$('main').onclick=ev=>{
 const w=cf;cf=!!ev.target.closest('#V');if(w!=cf&&mode=='s')draw();
 const el=ev.target.closest('[data-i]');if(!el)return;
 const k=+el.dataset.k,i=+el.dataset.i;
 k?ni=i:(fi=i,ni=0);pane=k+1;draw();
};
$('#ch').onclick=ev=>{
 const el=ev.target.closest('[data-i]');if(!el)return;
 const i=+el.dataset.i;
 if(pane==1){fi=i;ni=0}else{const x=N()[i];leave();ni=N().indexOf(x)}
 draw();
};
onpopstate=()=>{const p=history.state&&history.state.p||0;hl=p;if(p<pane){leave();pane=p;draw()}};
// drag the dividers to resize the columns (saved per device)
document.querySelectorAll('.g').forEach(g=>g.onpointerdown=ev=>{
 const k='--w'+g.dataset.c,x0=ev.clientX,w0=$('#P'+g.dataset.c).offsetWidth;
 g.setPointerCapture(ev.pointerId);
 g.onpointermove=m=>{const w=Math.max(100,Math.min(600,w0+m.clientX-x0));document.documentElement.style.setProperty(k,w+'px');L[k]=w};
 g.onpointerup=()=>g.onpointermove=null;
});
['--w0','--w1'].forEach(k=>L[k]&&document.documentElement.style.setProperty(k,L[k]+'px'));

