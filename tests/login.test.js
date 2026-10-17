// Sign-in rules: background sync never opens a Google screen; only a tap does. Covers the three situations:
// website with login server, website without one (GitHub Pages), Android app.
const {load,wait,reply,tools}=require('./harness');
// a fake network: login server + Google Drive. opts.srv: 'signedin' | 'signedout' | 'none'
function net(opts){
 const log=[];
 const f=async(u,o={})=>{
  u=String(u);const m=o.method||'GET';log.push(m+' '+u.replace(/^https:\/\/www\.googleapis\.com\//,''));
  if(u.includes('api/auth')){
   if(opts.srv=='none')return reply(404,'<html>404</html>','text/html');
   const a=/a=(\w+)/.exec(u)[1];
   if(a=='refresh')return opts.srv=='signedin'||opts.codeDone?reply(200,{access_token:'AT',expires_in:3600}):reply(401,{error:'signed_out'});
   if(a=='code'){opts.codeDone=1;opts.codeBody=o.body;return reply(200,{access_token:'AT',expires_in:3600})}
   return reply(200,{});
  }
  if(u.includes('drive/v3/files?fields'))return reply(200,{files:[{id:'F1'}]});
  if(u.includes('alt=media'))return reply(200,'','text/plain');
  return reply(200,{});
 };
 f.log=log;return f;
}
const status=g=>g("document.getElementById('st').textContent");
module.exports=async ok=>{
 // 1. website + login server, this device already signed in -> silent
 {
  const f=net({srv:'signedin'});
  const {win,g,nav,errs,close}=await load({fetch:f,ls:{link:'1'},settle:700});
  ok(status(g)=='●','server + signed in: startup sync finishes silently (status '+status(g)+')');
  ok(f.log.some(x=>x.includes('POST api/auth?a=refresh'))&&nav.length==0,'it asked the server for a token, no page change');
  g('tok=\'\';L.exp=0');await win.eval('sync()');await wait(200);
  ok(status(g)=='●'&&nav.length==0,'token expired: silently renewed through the server, no page change');
  ok(errs.length==0,'no script errors '+JSON.stringify(errs));close();
 }
 // 2. website + login server, not signed in on this device
 {
  const f=net({srv:'signedout'});
  const {win,g,nav,close}=await load({fetch:f,ls:{link:'1'},settle:600});
  ok(nav.length==0&&status(g)=='!','server + signed out: background sync does nothing visible (status '+status(g)+', page changes '+nav.length+')');
  await win.eval('sync()');await wait(100);ok(nav.length==0,'timer/focus sync never sends you to Google');
  win.eval('syncNow()');await wait(200);
  ok(nav.length==1,'tapping sync: goes to the Google sign-in page (api/auth?a=start)');
  close();
 }
 // 3. no login server (GitHub Pages): Google popup only on a tap
 {
  let popups=0;const f=net({srv:'none'});
  const {win,g,close}=await load({fetch:f,ls:{link:'1'},settle:600});
  win.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken(){popups++;c.callback({access_token:'AT',expires_in:3600})}})}}};
  await win.eval('sync()');await wait(150);
  ok(popups==0,'no login server: background sync opens no popup');
  win.eval('syncNow()');await wait(400);
  ok(popups==1&&status(g)=='●','no login server: tap opens the popup once and syncs (popups '+popups+', status '+status(g)+')');
  win.eval('tok=\'\';L.exp=0');await win.eval('sync()');await wait(150);
  ok(popups==1,'token ran out later: still no popup without a tap');
  close();
 }
 // 4. Android app with login server
 {
  const calls={login:0,init:0},o={srv:'signedout'};const f=net(o);
  const cap=w=>({isNativePlatform:()=>true,Plugins:{
   SocialLogin:{initialize:async()=>{calls.init++},login:async()=>{calls.login++;return {result:{serverAuthCode:'CODE1'}}}},
   LocalNotifications:{checkPermissions:async()=>({display:'granted'}),requestPermissions:async()=>({display:'granted'}),createChannel:async()=>{},registerActionTypes:async()=>{},addListener:()=>{},getPending:async()=>({notifications:[]}),cancel:async()=>{},schedule:async()=>{}},
   App:{minimizeApp(){}}}});
  const {win,g,nav,errs,close}=await load({fetch:f,cap,ls:{link:'1'},settle:600});
  await win.eval('sync()');await wait(150);
  ok(calls.login==0&&status(g)=='!','Android: background sync never shows the account sheet');
  win.eval('syncNow()');await wait(400);
  ok(calls.login==1&&nav.length==0,'Android: tap shows the account sheet once, no web page');
  ok(o.codeBody&&JSON.parse(o.codeBody).code=='CODE1','the one-time code goes to the login server');
  ok(status(g)=='●','Android: signed in and synced');
  g('tok=\'\';L.exp=0');await win.eval('sync()');await wait(200);
  ok(calls.login==1&&status(g)=='●','Android: next hour the token is renewed silently (no sheet)');
  ok(errs.length==0,'no script errors '+JSON.stringify(errs));close();
 }
 // 5. Android app, login server missing -> clear message, no popup
 {
  const f=net({srv:'none'});
  const cap=w=>({isNativePlatform:()=>true,Plugins:{SocialLogin:{initialize:async()=>{},login:async()=>({result:{serverAuthCode:'x'}})}}});
  const {win,g,close}=await load({fetch:f,cap,ls:{link:'1'},settle:600});
  win.eval('syncNow()');await wait(300);
  ok(g("document.getElementById('ts').textContent").includes('login server')&&!win.document.querySelector('script[src*="gsi"]'),'Android without login server: says so, no Google popup attempted');
  close();
 }
 // 6. sign out
 {
  const f=net({srv:'signedin'});
  const {win,g,close}=await load({fetch:f,ls:{link:'1'},settle:600});
  await win.eval('signOut()');await wait(50);
  ok(f.log.some(x=>x.includes('a=logout'))&&g('L.link')==undefined&&status(g)=='○','sign out: server cookie cleared, link forgotten, status ○');
  close();
 }
};
