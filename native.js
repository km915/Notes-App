// native.js — only active inside the Android app (Capacitor). In a normal browser every function here does nothing.
//  1. Sign-in with Android's own Google account sheet (Google blocks its web login page inside apps)
//  2. Task reminders: a notification at each task's start with the buttons "Mark as done" and "Reschedule"
// Needs: core.js, calendar.js (D, TD, taskForm), sync.js (srv, sync); app.js calls remindInit() at startup.
// Loaded 5th (plain <script> tags in index.html share one global scope; order matters).
//
// How a page loaded from a web address talks to the phone: Capacitor puts window.Capacitor.Plugins.<Name> into the
// page for every native plugin built into the APK. No bundler or import is needed. (Which plugins exist is fixed
// when the APK is built: see mobile/prepare.mjs.)

const NATIVE=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
const NP=NATIVE?Capacitor.Plugins:{};
const LN=NP.LocalNotifications;

// ---- 1. Sign-in. Android gives a one-time code; the login server turns it into the same secure cookie the laptop uses ----
async function nativeLogin(){ // returns {access_token,expires_in}, or null when the login server is missing
 const S=NP.SocialLogin;if(!S)throw 'SocialLogin plugin missing';
 await S.initialize({google:{webClientId:CID,mode:'offline'}});
 const r=await S.login({provider:'google',options:{scopes:[SCOPE],forceRefreshToken:true}});
 return srv('code',{code:r.result.serverAuthCode});
}

// ---- 2. Reminders ----
const RDAYS=14,RMAX=60; // schedule the next 14 days, at most 60 notifications; every app start, save and sync tops the list up
const nid=s=>{let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h%2147483000+1}; // task id -> notification number
const startMs=x=>new Date(x.d+'T'+x.s).getTime(); // local time
let pt,pf=0,pb=0,ps='',seenAt=Date.now(); // timer, "force" flag, busy flag, what is scheduled now, when the app last came to the front
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible')seenAt=Date.now()});
function plan(force){ // call after anything changed; many calls in a row make one rescheduling
 if(!LN)return;pf=pf||force===true;clearTimeout(pt);pt=setTimeout(planNow,1500);
}
async function planNow(){
 if(pb){pf=1;pt=setTimeout(planNow,500);return}
 pb=1;const f=pf;pf=0;
 try{
  if((await LN.checkPermissions()).display!='granted')return; // the user said no: remindCheck() explains how to fix it
  const t0=Date.now();
  const list=D.t.filter(x=>!x.x&&!x.z&&startMs(x)>t0+3000&&startMs(x)<=t0+RDAYS*864e5).sort((a,b)=>startMs(a)-startMs(b)).slice(0,RMAX);
  const items=list.map(x=>({id:nid(x.id),title:x.b,body:x.s+'–'+x.e+(x.ed?' (next day)':''),schedule:{at:new Date(startMs(x)),allowWhileIdle:true},actionTypeId:'TASK',channelId:'tasks',extra:{t:x.id}}));
  const sig=JSON.stringify(items.map(i=>[i.id,i.title,i.body,+i.schedule.at]));
  if(!f&&sig==ps)return; // nothing changed
  const p=await LN.getPending();
  if(p.notifications.length)await LN.cancel({notifications:p.notifications.map(n=>({id:n.id}))});
  if(items.length)await LN.schedule({notifications:items});
  ps=sig;
 }catch(e){console.error('reminders',e)}finally{pb=0} // finally: also when the function returns early above
}
function remindAct(a,id){ // a button on a notification (or the notification itself) was pressed
 const x=id&&D.t.find(y=>y.id==id&&!y.x);if(!x)return;
 const fresh=document.visibilityState!='visible'||Date.now()-seenAt<3000; // this press brought the app to the front
 if(ov){ov=null;O.hidden=1;O2.hidden=1}
 cd=x.d;ti=Math.max(0,TD(cd).indexOf(x));mode='c';cv='d';cf=1;
 if(a=='done'){
  x.z=1;x.t=Date.now();save();draw();toast('Done: '+x.b,1800);
  clearTimeout(tm);sync(); // send it to Drive at once
  if(fresh&&NP.App)setTimeout(()=>NP.App.minimizeApp(),1800); // Android always opens the app for a button: go back to what you were doing
 }else if(a=='move'){draw();taskForm(x,1)} // Reschedule: this task, start-time dial already open
 else draw(); // the notification itself: show the task's day
}
async function remindInit(){
 if(!LN)return;
 try{
  LN.addListener('localNotificationActionPerformed',e=>remindAct(e.actionId,e.notification&&e.notification.extra&&e.notification.extra.t)); // a press that started the app is held until now
  const p=await LN.checkPermissions();
  if(p.display!='granted'&&p.display!='denied')await LN.requestPermissions(); // Android 13+: the "Allow notifications?" question
  await LN.createChannel({id:'tasks',name:'Task reminders',description:'A reminder when a task starts',importance:4,visibility:1,vibration:true}); // 4 = pops up on screen
  await LN.registerActionTypes({types:[{id:'TASK',actions:[{id:'done',title:'Mark as done'},{id:'move',title:'Reschedule'}]}]});
  plan(true);
 }catch(e){console.error('remindInit',e)}
}
async function remindCheck(){ // menu command: shows what is wrong, then sends a test reminder
 if(!LN)return toast('Reminders only work in the Android app');
 try{
  let p=await LN.checkPermissions();
  if(p.display!='granted')p=await LN.requestPermissions();
  if(p.display!='granted')return toast('Notifications are off. Android Settings > Apps > Notes > Notifications: allow',7000);
  let ex='granted';try{ex=(await LN.checkExactNotificationSetting()).exact_alarm}catch(e){}
  if(ex!='granted'){toast('Allow "Alarms & reminders" for Notes, then come back',6000);await LN.changeExactNotificationSetting();return}
  pf=1;await planNow();
  await LN.schedule({notifications:[{id:1,title:'Test reminder',body:'Tap Reschedule or Mark as done: nothing will change',schedule:{at:new Date(Date.now()+10000),allowWhileIdle:true},actionTypeId:'TASK',channelId:'tasks',extra:{t:'test'}}]});
  const n=(await LN.getPending()).notifications.length-1;
  toast(`Reminders on: ${n} task${n==1?'':'s'} planned. A test arrives in 10 s: press the home button now`,7000);
 }catch(e){toast('Reminder check failed: '+(e&&e.message||e),6000)}
}
