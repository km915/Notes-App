// Reminders (Android app only): what gets scheduled, when, and what the two buttons do. The phone's notification
// system is faked; whether real Android shows them is something only a real phone can tell.
const {load,wait,reply}=require('./harness');
function fake(perm='granted'){
 const s={perm,sched:[],pend:[],listener:null,sets:0,min:0,calls:[]};
 s.cap=w=>({isNativePlatform:()=>true,Plugins:{
  LocalNotifications:{
   checkPermissions:async()=>({display:s.perm}),requestPermissions:async()=>({display:s.perm}),
   checkExactNotificationSetting:async()=>({exact_alarm:'granted'}),changeExactNotificationSetting:async()=>{},
   createChannel:async c=>s.calls.push(['channel',c.id,c.importance]),registerActionTypes:async t=>s.calls.push(['actions',t.types[0].actions.map(a=>a.title).join('|')]),
   addListener:(n,fn)=>{s.listener=fn},getPending:async()=>({notifications:s.pend.map(n=>({id:n.id}))}),
   cancel:async()=>{s.pend=[]},schedule:async o=>{s.sets++;s.sched=o.notifications;s.pend=s.pend.concat(o.notifications)}},
  App:{minimizeApp(){s.min++}}}});
 return s;
}
const hm=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
const mk=(g,ms,b,extra='')=>{const d=new Date(Date.now()+ms),e=new Date(+d+15*6e4);return g(`add(D.t,{b:${JSON.stringify(b)},d:iso(new Date(${+d})),s:'${hm(d)}',e:'${hm(e)}'${extra}}).id`)};
const net=async()=>reply(401,{error:'signed_out'}); // no sign-in: sync does nothing
module.exports=async ok=>{
 // schedule rules
 {
  const s=fake();const {win,g,errs,close}=await load({cap:s.cap,fetch:net});
  ok(s.calls.some(c=>c[0]=='channel'&&c[1]=='tasks'&&c[2]==4)&&s.calls.some(c=>c[0]=='actions'&&c[1]=='Mark as done|Reschedule'),'startup: channel "tasks" (pops up) and the two buttons are registered');
  const H=36e5,D=24*H;
  mk(g,3*H,'later today');mk(g,H,'soon');mk(g,D+H,'tomorrow');
  mk(g,20*D,'too far');mk(g,-2*H,'past');mk(g,2*H,'done one',',z:1');
  const dl=mk(g,4*H,'deleted one');g(`D.t.find(x=>x.id=='${dl}').x=1;D.t.find(x=>x.id=='${dl}').t=Date.now();save()`);
  await wait(1900);
  ok(s.sched.length==3&&s.sched.map(n=>n.title).join()=='soon,later today,tomorrow','schedules only future, not-done, not-deleted tasks within 14 days, in time order -> '+s.sched.map(n=>n.title));
  const n=s.sched[0];
  ok(n.actionTypeId=='TASK'&&n.channelId=='tasks'&&n.schedule.allowWhileIdle&&n.extra.t&&n.body.includes('–'),'notification carries buttons, channel, exact-while-idle flag and the task id');
  const t0=s.sets;g('plan();plan();plan()');await wait(1900);
  ok(s.sets==t0,'nothing changed: no rescheduling');
  g(`save();save()`);await wait(1900);ok(s.sets==t0,'several saves in a row without changes: still none');
  mk(g,5*H,'new one');mk(g,6*H,'another');await wait(1900);
  ok(s.sets==t0+1&&s.sched.length==5,'two new tasks: ONE rescheduling for both, 5 planned');
  close();
  ok(errs.length==0,'no script errors '+JSON.stringify(errs));
 }
 // limit of 60
 {
  const s=fake();const {g,close}=await load({cap:s.cap,fetch:net});
  for(let i=0;i<70;i++)mk(g,(i+1)*36e5,'t'+i);
  await wait(1900);ok(s.sched.length==60&&s.sched[0].title=='t0','more than 60 tasks: the nearest 60 are scheduled ('+s.sched.length+')');
  const ids=new Set(s.sched.map(n=>n.id));ok(ids.size==60,'every notification has its own number');
  close();
 }
 // permission denied
 {
  const s=fake('denied');const {g,close}=await load({cap:s.cap,fetch:net});
  mk(g,36e5,'x');await wait(1900);ok(s.sets==0,'notifications refused: nothing scheduled, no errors');
  await g('remindCheck()');await wait(50);
  ok(g("document.getElementById('ts').textContent").includes('Notifications are off'),'check command explains where to switch them on');
  close();
 }
 // buttons
 {
  const s=fake();const {win,g,close}=await load({cap:s.cap,fetch:net});
  const a=mk(g,36e5,'Call mum'),b=mk(g,2*36e5,'Pay rent'),c=mk(g,3*36e5,'Gym');
  await wait(1900);
  ok(typeof s.listener=='function','the button listener is installed at startup');
  s.sets=0;s.listener({actionId:'done',notification:{extra:{t:a}}});await wait(60);
  ok(g(`D.t.find(x=>x.id=='${a}').z`)==1,'"Mark as done": task is marked done');
  ok(g("document.getElementById('ts').textContent").includes('Done: Call mum'),'...and says so');
  await wait(1900);ok(s.sets==1&&!s.sched.some(n=>n.extra.t==a)&&s.sched.length==2,'...and its reminder list is rebuilt without it');
  s.listener({actionId:'move',notification:{extra:{t:b}}});await wait(60);
  ok(g('ov&&ov.form')&&win.document.getElementById('fb').value=='Pay rent','"Reschedule": this task opens in the edit form');
  ok(g('dm&&dm.w')=='s'&&!win.document.getElementById('o2').hidden,'...with the start-time dial already open');
  win.document.getElementById('fx').click();await wait(30);
  s.listener({actionId:'tap',notification:{extra:{t:c}}});await wait(60);
  ok(!g('ov')&&g('mode')=='c'&&g('cd')==g(`D.t.find(x=>x.id=='${c}').d`),'tapping the notification itself: shows that task\'s day');
  s.listener({actionId:'done',notification:{extra:{t:'test'}}});s.listener({actionId:'done',notification:{extra:{t:'gone'}}});s.listener({actionId:'done',notification:{}});
  ok(true,'buttons on a test/unknown/empty notification are ignored without errors');
  close();
 }
 // done button when app was already open does not hide the app; when it was brought forward it goes back
 {
  const s=fake();const {win,g,close}=await load({cap:s.cap,fetch:net});
  const a=mk(g,36e5,'A');await wait(1900);
  g('seenAt=Date.now()-60000');s.listener({actionId:'done',notification:{extra:{t:a}}});await wait(2000);
  ok(s.min==0,'app was open and in use: Done does not minimise it');
  const b=mk(g,2*36e5,'B');g('seenAt=Date.now()');s.listener({actionId:'done',notification:{extra:{t:b}}});await wait(2000);
  ok(s.min==1,'press came from the notification: app steps back to the background after 2 s');
  close();
 }
 // test command
 {
  const s=fake();const {g,close}=await load({cap:s.cap,fetch:net});
  mk(g,36e5,'x');await wait(1900);await g('remindCheck()');await wait(50);
  const t=s.sched.find(n=>n.id==1);
  ok(t&&+t.schedule.at-Date.now()<11000&&+t.schedule.at-Date.now()>8000,'check command: test reminder in about 10 s');
  ok(g("document.getElementById('ts').textContent").includes('1 task planned'),'...and reports how many real tasks are planned: '+g("document.getElementById('ts').textContent"));
  close();
 }
 // browser: nothing happens
 {
  const {g,errs,close}=await load({fetch:net});
  mk(g,36e5,'x');await wait(1900);await g('remindCheck()');await wait(30);
  ok(g("document.getElementById('ts').textContent")=='Reminders only work in the Android app'&&errs.length==0,'in a normal browser: reminders do nothing, the command says why');
  close();
 }
};
