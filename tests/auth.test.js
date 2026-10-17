// The login server (api/auth.js) called directly with fake requests; Google's token endpoint is faked.
const handler=require('../api/auth.js');
const SITE='https://notes.example.app';
function run(o){
 return new Promise(async done=>{
  const h={};let body='';
  const res={statusCode:200,setHeader:(k,v)=>h[k.toLowerCase()]=v,end:b=>done({code:res.statusCode,h,json:b?JSON.parse(b||'null'):null,raw:b})};
  const origin=o.origin===undefined?SITE:o.origin;
  const req={method:o.method||'GET',url:o.url,headers:{...(origin?{origin}:{}),...(o.cookie?{cookie:o.cookie}:{})},body:o.body};
  try{await handler(req,res)}catch(e){done({crash:e})}
  if(!h.__done)setTimeout(()=>done({code:res.statusCode,h,json:null,raw:'(no end)'}),5);
 });
}
// fake Google: queue of replies; remembers what it was asked
const asked=[];let replies=[];
global.fetch=async(u,o)=>{asked.push(Object.fromEntries(new URLSearchParams(o.body)));const r=replies.shift()||{status:200,json:{}};return {ok:r.status<300,status:r.status,json:async()=>r.json}};
const G=(status,json)=>replies.push({status,json});
const setCookies=r=>[].concat(r.h['set-cookie']||[]);
module.exports=async ok=>{
 process.env.SITE_URL=SITE+'/';process.env.GOOGLE_CLIENT_SECRET='SECRET';
 // not configured
 delete process.env.GOOGLE_CLIENT_SECRET;
 let r=await run({method:'POST',url:'/api/auth?a=refresh'});ok(r.code==501&&r.json.error=='not_configured','secret missing -> 501 (the app then uses the popup)');
 process.env.GOOGLE_CLIENT_SECRET='SECRET';
 const old=process.env.SITE_URL;delete process.env.SITE_URL;r=await run({method:'POST',url:'/api/auth?a=refresh'});ok(r.code==501,'SITE_URL missing (a Vercel preview) -> 501');process.env.SITE_URL=old;
 // start
 r=await run({url:'/api/auth?a=start'});
 const loc=new URL(r.h.location||'http://none/'),st=setCookies(r)[0]||'';
 ok(r.code==302&&loc.host=='accounts.google.com','start: redirects to Google');
 ok(loc.searchParams.get('access_type')=='offline'&&loc.searchParams.get('prompt')=='consent'&&loc.searchParams.get('scope')=='https://www.googleapis.com/auth/drive.file'&&loc.searchParams.get('redirect_uri')==SITE+'/api/auth','start: asks for a refresh token, drive.file only, comes back to /api/auth');
 ok(/^st=[0-9a-f]{32};/.test(st)&&/HttpOnly/.test(st)&&/SameSite=Lax/.test(st)&&/Secure/.test(st)&&loc.searchParams.get('state')==/st=(\w+)/.exec(st)[1],'start: random state saved in a short-lived httpOnly cookie and sent to Google');
 ok(!r.raw||!String(r.raw).includes('SECRET'),'the secret is never in the reply');
 // callback
 const state='a'.repeat(32);
 r=await run({url:`/api/auth?code=C1&state=${'b'.repeat(32)}`,cookie:'st='+state});ok(r.code==400&&r.json.error=='state_mismatch'&&asked.length==0,'callback with a wrong state: refused before talking to Google');
 r=await run({url:`/api/auth?code=C1&state=${state}`});ok(r.code==400&&r.json.error=='state_mismatch','callback without the state cookie: refused');
 r=await run({url:`/api/auth?code=C1&state=short`,cookie:'st='+state});ok(r.code==400,'callback with a different-length state: refused, no crash');
 G(200,{refresh_token:'RT1',access_token:'AT1',expires_in:3599});
 r=await run({url:`/api/auth?code=C1&state=${state}`,cookie:'st='+state});
 let c=setCookies(r),rt=c.find(x=>x.startsWith('rt='));
 ok(r.code==302&&r.h.location=='/'&&rt&&rt.includes('RT1')&&/HttpOnly/.test(rt)&&/SameSite=Strict/.test(rt)&&/Path=\/api\/auth/.test(rt)&&/Max-Age=34560000/.test(rt),'callback ok: refresh token in an httpOnly, Strict, 400-day cookie limited to /api/auth, then back to the app');
 ok(c.some(x=>x.startsWith('st=;')&&/Max-Age=0/.test(x)),'...and the state cookie is cleared');
 ok(asked[0].grant_type=='authorization_code'&&asked[0].code=='C1'&&asked[0].client_secret=='SECRET'&&asked[0].redirect_uri==SITE+'/api/auth','code exchanged with the secret and the same redirect address');
 ok(!r.raw,'the token is not in the page');
 G(200,{access_token:'AT'});r=await run({url:`/api/auth?code=C1&state=${state}`,cookie:'st='+state});ok(r.code==400&&r.json.error=='no_refresh_token'&&r.json.hint.includes('permissions'),'Google gave no refresh token: clear message');
 G(400,{error:'invalid_grant'});r=await run({url:`/api/auth?code=C1&state=${state}`,cookie:'st='+state});ok(r.code==400&&r.json.error=='google','Google rejects the code: 400');
 r=await run({url:'/api/auth?error=access_denied'});ok(r.code==302&&r.h.location=='/','pressing Cancel at Google: back to the app, nothing stored');
 r=await run({url:'/api/auth'});ok(r.code==400,'GET without a purpose: 400');
 // refresh
 r=await run({method:'POST',url:'/api/auth?a=refresh',origin:'https://evil.example'});ok(r.code==403,'refresh from another website: 403');
 r=await run({method:'POST',url:'/api/auth?a=refresh',origin:''});ok(r.code==403,'refresh without an Origin header: 403');
 r=await run({method:'POST',url:'/api/auth?a=refresh'});ok(r.code==401&&r.json.error=='signed_out','refresh without cookie: 401 signed_out');
 asked.length=0;G(200,{access_token:'AT2',expires_in:3599});
 r=await run({method:'POST',url:'/api/auth?a=refresh',cookie:'rt=RT1; other=1'});
 ok(r.code==200&&r.json.access_token=='AT2'&&r.json.expires_in==3599&&asked[0].grant_type=='refresh_token'&&asked[0].refresh_token=='RT1','refresh: new access token returned');
 ok(setCookies(r).some(x=>x.startsWith('rt=RT1')&&/Max-Age=34560000/.test(x)),'refresh: cookie lifetime renewed (stays signed in as long as it is used)');
 ok(!Object.keys(r.json).includes('refresh_token'),'refresh token never in the reply body');
 G(400,{error:'invalid_grant'});r=await run({method:'POST',url:'/api/auth?a=refresh',cookie:'rt=RT1'});
 ok(r.code==401&&setCookies(r).some(x=>x.startsWith('rt=;')&&/Max-Age=0/.test(x)),'refresh token revoked: 401 and cookie removed');
 G(500,{error:'backend_error'});r=await run({method:'POST',url:'/api/auth?a=refresh',cookie:'rt=RT1'});
 ok(r.code==502&&!setCookies(r).length,'Google temporarily down: 502, cookie kept (no forced sign-out)');
 // android code
 asked.length=0;G(200,{refresh_token:'RT9',access_token:'AT9',expires_in:3599});
 r=await run({method:'POST',url:'/api/auth?a=code',body:{code:'AC1'}});
 ok(r.code==200&&r.json.access_token=='AT9'&&setCookies(r).some(x=>x.startsWith('rt=RT9'))&&asked.length==1&&!('redirect_uri' in asked[0]),'Android code: exchanged (first try, no redirect address), cookie set, token returned');
 asked.length=0;G(400,{error:'redirect_uri_mismatch'});G(400,{error:'redirect_uri_mismatch'});G(200,{refresh_token:'RT9',access_token:'AT9',expires_in:1});
 r=await run({method:'POST',url:'/api/auth?a=code',body:'{"code":"AC2"}'});
 ok(r.code==200&&asked.length==3&&asked[1].redirect_uri==''&&asked[2].redirect_uri==SITE+'/api/auth','Android code: redirect mismatch -> retries with "" then the site address (body may be a string)');
 G(400,{error:'invalid_grant'});r=await run({method:'POST',url:'/api/auth?a=code',body:{code:'bad'}});ok(r.code==400&&r.json.detail=='invalid_grant','Android code rejected by Google: 400, no cookie');
 r=await run({method:'POST',url:'/api/auth?a=code',body:{}});ok(r.code==400&&r.json.error=='no_code','no code: 400');
 r=await run({method:'POST',url:'/api/auth?a=code',body:{code:{x:1}}});ok(r.code==400,'code of the wrong type: 400');
 r=await run({method:'POST',url:'/api/auth?a=code',body:'not json'});ok(r.code==400,'unreadable body: 400, no crash');
 G(200,{access_token:'x'});r=await run({method:'POST',url:'/api/auth?a=code',body:{code:'AC3'}});ok(r.code==400&&r.json.error=='no_refresh_token','Android: no refresh token -> explained');
 r=await run({method:'POST',url:'/api/auth?a=code',body:{code:'x'},origin:'https://evil.example'});ok(r.code==403,'code from another website: 403');
 // logout
 r=await run({method:'POST',url:'/api/auth?a=logout'});ok(r.code==200&&setCookies(r).some(x=>x.startsWith('rt=;')&&/Max-Age=0/.test(x)),'logout: cookie removed');
 r=await run({method:'POST',url:'/api/auth?a=logout',origin:'https://evil.example'});ok(r.code==403,'logout from another website: 403');
 r=await run({method:'PUT',url:'/api/auth'});ok(r.code==405,'other methods: 405');
 // plain http (local testing): no Secure flag
 process.env.SITE_URL='http://localhost:3000';r=await run({url:'/api/auth?a=start',origin:'http://localhost:3000'});ok(!/Secure/.test(setCookies(r)[0]),'http://localhost: cookie without Secure (so local tests work)');
 process.env.SITE_URL=SITE;
};
