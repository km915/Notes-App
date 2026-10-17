// Phone behaviour (touch screen: long press, vibration, Back button, calendar) and a check that the laptop gets none of it.
const {load,wait,tools}=require('./harness');
async function run(phoneMode,ok){
 const {win,errs,close}=await load({phone:phoneMode});
 const d=win.document,g=s=>win.eval(s);
 const {ptr,click}=tools(win);
 const tap=el=>{ptr(el,'pointerdown');ptr(el,'pointerup');click(el)};
 const hold=async(el,type='touch')=>{ptr(el,'pointerdown',10,10,type);await wait(620)};          // finger stays down, then...
 const lift=el=>{ptr(el,'pointerup');click(el)};                       // ...lifts (browser sends a click)
 const sheetItems=()=>[...d.querySelectorAll('#ls [data-o]')].map(x=>x.textContent);
 const live=()=>g('({f:live(D.f).map(f=>f.name),n:live(D.n).filter(n=>n.f!="todo").map(n=>n.b.split("\\n")[0])})');
 // seed: two folders, notes
 g(`add(D.f,{name:'Work'});add(D.n,{f:'d',b:'Alpha\\nx'});add(D.n,{f:'d',b:'Beta\\ny'});fi=1;pane=0;draw()`);
 await wait(30);
 if(!phoneMode){
   const row=d.querySelector('#P0 [data-i="1"]');const ce=new win.MouseEvent('contextmenu',{bubbles:true,cancelable:true});row.dispatchEvent(ce);
  ok(!ce.defaultPrevented&&!g('ov'),'right-click on a folder row: browser menu untouched, no sheet');
  ptr(row,'pointerdown',10,10,'mouse');await wait(620);ok(!g('ov'),'mouse press-and-hold on a row does nothing');
  ptr(d.getElementById('mn'),'pointerdown',1,1,'mouse');ok(win.vibes.length==0&&!d.getElementById('mn').classList.contains('pr'),'mouse press: no vibration, no glow');
  g(`mode='c';cv='m';draw()`);await wait(20);
  const dc=d.querySelector('#V .dc');await hold(dc,'mouse');ok(!g('ov'),'hold on a day with a mouse-type pointer: no new-task form');
  g(`add(D.t,{b:'T',d:cd,s:'09:00',e:'09:15'});drawC()`);await wait(10);
  const ce2=new win.MouseEvent('contextmenu',{bubbles:true,cancelable:true});d.querySelector('#V [data-t],#V .dc i').dispatchEvent(ce2);
  ok(ce2.defaultPrevented,'right-click in calendar still swallowed (as before)');
  g(`cv='d';drawC()`);await wait(10);
  await wait(350);const tk=d.querySelector('#V [data-t]');tk.dispatchEvent(new win.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
  ok(g('ov&&!!ov.sh')&&sheetItems().join()=='Edit task,Delete task','right-click a task (laptop): Edit / Delete menu as before');
  const dcs=d.querySelectorAll('#V .dc');
  g(`close();cv='m';drawC()`);await wait(10);
  const chips=d.querySelector('#V .dc.s').querySelectorAll('i').length;ok(chips==1,'desktop month cell unchanged (shows the task chip, up to 3)');
  win.eval('1');close();return;
 }
 // 1 press feedback
 const mn=d.getElementById('mn');ptr(mn,'pointerdown');
 ok(win.vibes.includes(12)&&mn.classList.contains('pr'),'touch press on a button: vibrates (12 ms) and glows');
 await wait(450);ok(!mn.classList.contains('pr'),'glow fades after a moment');
 // 2 long press on a folder row
 let row=d.querySelector('#P0 [data-i="1"]');win.vibes.length=0;
 await hold(row);
 ok(g('ov&&!!ov.sh')&&sheetItems().join()=='Rename folder,Delete folder,Cancel','long press on folder row: sheet Rename / Delete / Cancel -> '+sheetItems());
 ok(win.vibes.includes(30),'long press gives its own stronger buzz');
 lift(row);ok(g('pane')==0&&g('ov&&!!ov.sh'),'finger lifting after the hold does not open the folder or close the sheet');
 tap(d.querySelector('#ls [data-o="1"]'));await wait(10);
 ok(sheetItems()[0]=='Delete'&&d.querySelector('#ls .hd').textContent.includes('Delete folder'),'Delete folder -> asks with buttons: '+d.querySelector('#ls .hd').textContent+' / '+sheetItems());
 tap(d.querySelector('#ls [data-o="1"]'));await wait(10);   // Cancel
 ok(!g('ov')&&live().f.includes('Notes'),'Cancel keeps the folder');
 row=d.querySelector('#P0 [data-i="1"]');await hold(row);lift(row);
 tap(d.querySelector('#ls [data-o="1"]'));await wait(10);tap(d.querySelector('#ls [data-o="0"]'));await wait(20);
 ok(!live().f.includes('Notes')&&!g('ov'),'Delete confirmed: folder "Notes" (and its notes) gone -> '+JSON.stringify(live()));
 // 3 note rows
 g(`add(D.f,{name:'Notes'});fi=F().length-1;add(D.n,{f:F()[fi].id,b:'Gamma\\nz'});add(D.n,{f:F()[fi].id,b:'Delta\\nw'});pane=1;ni=0;draw()`);await wait(20);
 row=d.querySelector('#P1 [data-i="1"]');await hold(row);lift(row);
 ok(sheetItems().join()=='Delete note,Cancel','long press on note row: Delete note / Cancel');
 ok(g('ni')==1&&g('pane')==1,'the held note became the selected one, stayed in the list');
 tap(d.querySelector('#ls [data-o="0"]'));await wait(10);
 ok(d.querySelector('#ls .hd').textContent.includes('Delete note'),'confirm: '+d.querySelector('#ls .hd').textContent);
 tap(d.querySelector('#ls [data-o="0"]'));await wait(20);
 ok(!live().n.includes('Delta')&&live().n.includes('Gamma'),'note deleted, other note kept -> '+live().n);
 // chips
 const chip=d.querySelector('#ch span[data-i="1"]');await hold(chip);lift(chip);
 ok(sheetItems().join()=='Rename folder,Delete folder,Cancel','long press on a chip (pane 1 = folders): folder menu');
 tap(d.querySelector('#ls [data-o="2"]'));await wait(10);
 // To-Do folder
 g(`fi=0;pane=0;draw()`);await wait(10);row=d.querySelector('#P0 [data-i="0"]');await hold(row);lift(row);
 ok(!g('ov')&&d.getElementById('ts').textContent.includes('To-Do'),'long press on To-Do folder: just a message');
 // 4 new task by long press
 g(`mode='c';cv='m';cd=iso(new Date());draw()`);await wait(20);
 ok(d.getElementById('V').classList.contains('mv'),'month view has the fixed-grid class');
 const target=d.querySelectorAll('#V .dc')[20];const day=target.dataset.d;
 await hold(target);
 ok(g('ov&&ov.form')&&d.getElementById('fd').value==day,'long press on a day cell opens the new-task form on that day ('+day+')');
 lift(target);ok(g('ov&&ov.form')&&g('cv')=='m','finger lifting does not close the form or jump to day view');
 d.getElementById('fx').click();await wait(10);
 ptr(d.querySelector('#V .tb [data-v="d"]'),'pointerdown');await wait(620);ok(!g('ov'),'long press on a toolbar button: nothing');
 g(`cv='d';cd='2026-10-20';draw()`);await wait(10);
 const empty=d.querySelector('#V .h');await hold(empty);ok(g('ov&&ov.form')&&d.getElementById('fd').value=='2026-10-20','day view: long press on empty space opens new task for the open day');
 d.getElementById('fx').click();await wait(10);
 // 5 month chips on phone
 g(`cv='m';cd=iso(new Date());for(const t of ['a','b','c'])add(D.t,{b:t,d:cd,s:'1'+(t=='a'?0:t=='b'?1:2)+':00',e:'13:00'});drawC()`);await wait(10);
 const cell=d.querySelector('#V .dc.s');const ch=[...cell.querySelectorAll('i')].map(x=>x.textContent);
 ok(ch.join()=='a,b,+1','phone month cell with 3 tasks: 2 chips + "+1" -> '+ch);
 // 6 back button
 g(`mode='n';pane=1;fi=2;draw()`);await wait(30);
 g(`menu()`);await wait(30);ok(g('pane')==1&&g('ov')&&g('hl')==2,'menu open at depth 2 (hl='+g('hl')+')');
 win.history.back();await wait(80);ok(!g('ov')&&g('pane')==1,'Back closes the menu and stays on the same screen');
 win.history.back();await wait(80);ok(g('pane')==0,'Back again goes up one level');
 g(`pane=1;draw()`);await wait(30);g(`newFolder()`);await wait(30);
 win.history.back();await wait(80);ok(!g('ov')&&g('pane')==1&&d.getElementById('o').hidden,'Back closes the "new folder" prompt, not the screen behind');
 g(`mode='c';cv='m';draw()`);await wait(30);g(`newTask()`);await wait(30);
 win.history.back();await wait(80);ok(!g('ov')&&d.getElementById('o2').hidden&&g('mode')=='c','Back closes the task form');
 g(`newTask()`);await wait(30);d.getElementById('fx').click();await wait(80);
 ok(g('history.state&&history.state.p||0')==g('pane')+(g('ov')?1:0),'closing the form with Cancel leaves history in step (state '+g('history.state&&history.state.p||0')+', pane '+g('pane')+')');
 // sheet cancel keeps history in step; sheet -> confirm sheet -> delete
 g(`mode='n';fi=2;pane=1;draw()`);await wait(30);
 row=d.querySelector('#P1 [data-i="0"]');await hold(row);lift(row);await wait(30);
 win.history.back();await wait(80);ok(!g('ov')&&g('pane')==1,'Back closes the long-press sheet');
 const before=g('history.state&&history.state.p||0');
 row=d.querySelector('#P1 [data-i="0"]');await hold(row);lift(row);tap(d.querySelector('#ls [data-o="0"]'));await wait(30);tap(d.querySelector('#ls [data-o="0"]'));await wait(80);
 ok(g('history.state&&history.state.p||0')==g('pane')&&!g('ov'),'sheet -> confirm -> delete: history ends in step (state '+g('history.state&&history.state.p||0')+', pane '+g('pane')+')');
 // 7 sync button
 g(`sync=()=>{}`);tap(d.getElementById('st'));
 ok(d.getElementById('ts').textContent=='Syncing…'&&!d.getElementById('ts').hidden,'sync button: shows "Syncing…"');
 g(`setSt('●')`);ok(d.getElementById('ts').textContent=='Synced','...then the result: '+d.getElementById('ts').textContent);
 g(`stAsk=0;setSt('!')`);ok(d.getElementById('ts').textContent=='Synced','background sync results do not pop messages');
 // 8 editor click on phone
 g(`add(D.n,{f:F()[2].id,b:'Eps\\nq'});mode='n';fi=2;pane=1;ni=0;draw()`);await wait(20);d.getElementById('E').focus();await wait(20);ok(g('pane')==2,'focusing the editor moves to pane 2');
 ok(errs.length==0,'no script errors '+JSON.stringify(errs));
 close();
}
module.exports=async ok=>{console.log(' [laptop pointer: nothing phone-like may appear]');await run(false,ok);console.log(' [phone]');await run(true,ok)};
