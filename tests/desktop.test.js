// Laptop behaviour must never change by accident: a scripted session (keys, prompts, calendar) is compared with a
// saved "golden" trace (desktop.golden.txt, recorded from the version before the phone work started).
const fs=require('fs'),path=require('path');
const {load,wait,tools}=require('./harness');
module.exports=async ok=>{
 const {win,errs,g,close}=await load({phone:false});
 const d=win.document,T=tools(win),lines=[];
 const key=(k,o={})=>T.key(d.activeElement&&d.activeElement!=d.body?d.activeElement:d.body,k,o);
 const snap=async l=>{await wait(15);
  lines.push(l.padEnd(22)+' '+JSON.stringify({pane:g('pane'),fi:g('fi'),ni:g('ni'),mode:g('mode'),cv:g('cv'),ov:!!g('ov'),
   folders:g('live(D.f).map(f=>f.name)'),notes:g('live(D.n).filter(n=>n.f!="todo").map(n=>n.b)'),tasks:g('D.t.filter(x=>!x.x).map(x=>[x.b,x.s,x.e,x.z||0])'),
   active:(d.activeElement.id||d.activeElement.tagName),title:d.getElementById('t').textContent,rows:d.getElementById('P1').children.length}))};
 const Q=d.getElementById('q');
 await snap('start');key('ArrowDown');await snap('down');key('n');await snap('n');
 T.type(d.getElementById('ET'),'Alpha');T.type(d.getElementById('E'),'body one');await snap('typed');
 key('Escape');await snap('esc');key('ArrowLeft');await snap('left');key('f');await snap('f prompt');
 T.type(Q,'Work');T.key(Q,'Enter');await snap('folder Work');
 key('r');T.type(Q,'Work2');T.key(Q,'Enter');await snap('renamed');
 key('ArrowLeft');key('d');await snap('d asks');T.type(Q,'y');T.key(Q,'Enter');await snap('deleted');
 key('Escape');await snap('menu open');key('Escape');T.key(Q,'Escape');await snap('menu closed');
 T.key(d.body,'Tab');T.key(d.body,'Enter');d.body.dispatchEvent(new win.KeyboardEvent('keyup',{bubbles:true,cancelable:true,key:'Tab'}));await snap('Tab+Enter');
 key('n');await snap('new task form');T.type(d.getElementById('fb'),'Task1');d.getElementById('fk').click();await snap('saved task');
 key('d');await snap('day view');key('x');await snap('done');key('x');key('ArrowDown',{altKey:true});await snap('shift +15');
 key('m');await snap('month');key('d');key('Delete');await snap('delete asks');T.type(Q,'y');T.key(Q,'Enter');await snap('task deleted');
 T.key(d.body,'Tab');T.key(d.body,'Enter');d.body.dispatchEvent(new win.KeyboardEvent('keyup',{bubbles:true,cancelable:true,key:'Tab'}));await snap('back to notes');
 const golden=fs.readFileSync(path.join(__dirname,'desktop.golden.txt'),'utf8').trim().split('\n').filter(l=>!l.startsWith('errors:'));
 let bad=0;lines.forEach((l,i)=>{if(l!=golden[i]){bad++;console.log('  differs at step',i+1,'\n   got   ',l.slice(0,200),'\n   wanted',(golden[i]||'').slice(0,200))}});
 ok(bad==0&&lines.length==golden.length,`laptop session matches the golden trace (${lines.length} steps)`);
 ok(errs.length==0,'no script errors '+JSON.stringify(errs));
 close();
};
