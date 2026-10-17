// api/auth.js — the login server. One Vercel serverless function (Node, no dependencies).
// It does the "authorization code" half of Google sign-in, so the long-lived refresh token never reaches
// the page's JavaScript: it lives in an httpOnly cookie that only this function can read.
//
//   GET  /api/auth?a=start     send the browser to Google's consent page
//   GET  /api/auth?code=...    Google sends the browser back here: trade the code for tokens, set the cookie
//   POST /api/auth?a=refresh   -> {access_token, expires_in}   (uses the cookie; the app calls this silently)
//   POST /api/auth?a=code      {code} from the Android app's native sign-in -> same answer, sets the cookie
//   POST /api/auth?a=logout    forget the cookie
//
// Settings (Vercel > Project > Settings > Environment Variables):
//   GOOGLE_CLIENT_SECRET  the Web client's secret (never put it in the repo)
//   SITE_URL              https://your-name.vercel.app  (no trailing slash; the only address allowed to call this)
//   GOOGLE_CLIENT_ID      optional; defaults to the ID in core.js
const crypto=require('crypto');
const CLIENT_ID=process.env.GOOGLE_CLIENT_ID||'58518608488-05qgos3pv2n23l76617aou61f46ihdlf.apps.googleusercontent.com';
const SCOPE='https://www.googleapis.com/auth/drive.file';
const DAYS400=400*86400; // cookie lifetime: the longest browsers allow

const send=(res,code,obj)=>{res.statusCode=code;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(obj))};
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split(/=(.*)/s).slice(0,2)).filter(a=>a[0]&&a[1]!=null).map(([k,v])=>[k,decodeURIComponent(v)]));
const ck=(name,val,age,secure,same)=>`${name}=${encodeURIComponent(val)}; Max-Age=${age}; Path=/api/auth; HttpOnly; SameSite=${same}${secure?'; Secure':''}`;

async function google(params){ // Google's token endpoint: {ok, json}
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,...params})});
 return {ok:r.ok,json:await r.json().catch(()=>({}))};
}

module.exports=async(req,res)=>{
 const site=(process.env.SITE_URL||'').replace(/\/$/,''),secure=site.startsWith('https');
 if(!site||!process.env.GOOGLE_CLIENT_SECRET)return send(res,501,{error:'not_configured'}); // previews and GitHub Pages end up here or at a 404: the app then falls back to the popup
 const q=new URL(req.url,'http://x').searchParams,a=q.get('a'),c=cookies(req);
 const keepRt=(rt,state)=>res.setHeader('Set-Cookie',[ck('rt',rt,DAYS400,secure,'Strict'),ck('st','',0,secure,'Lax')]); // Strict: only our own pages can send it

 if(req.method=='GET'){
  if(a=='start'){
   const state=crypto.randomBytes(16).toString('hex');
   res.setHeader('Set-Cookie',ck('st',state,600,secure,'Lax')); // Lax: it has to come back with Google's redirect
   const p=new URLSearchParams({client_id:CLIENT_ID,redirect_uri:site+'/api/auth',response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state});
   res.statusCode=302;res.setHeader('Location','https://accounts.google.com/o/oauth2/v2/auth?'+p);return res.end();
  }
  if(q.get('code')||q.get('error')){ // Google sent the browser back
   if(q.get('error')){res.statusCode=302;res.setHeader('Location','/');return res.end()} // pressed Cancel
   const s=q.get('state')||'';
   if(!c.st||c.st.length!=s.length||!crypto.timingSafeEqual(Buffer.from(c.st),Buffer.from(s)))return send(res,400,{error:'state_mismatch',hint:'Sign-in expired. Go back to the app and tap sync again.'});
   const r=await google({grant_type:'authorization_code',code:q.get('code'),redirect_uri:site+'/api/auth'});
   if(!r.ok)return send(res,400,{error:'google',detail:r.json.error});
   if(!r.json.refresh_token)return send(res,400,{error:'no_refresh_token',hint:'Remove "Notes" at myaccount.google.com/permissions, then sign in again.'});
   keepRt(r.json.refresh_token);res.statusCode=302;res.setHeader('Location','/');return res.end();
  }
  return send(res,400,{error:'bad_request'});
 }

 if(req.method=='POST'){
  if(req.headers.origin!==site)return send(res,403,{error:'bad_origin'}); // browsers always send Origin on POST: only our own page may call this
  if(a=='refresh'){
   if(!c.rt)return send(res,401,{error:'signed_out'});
   const r=await google({grant_type:'refresh_token',refresh_token:c.rt});
   if(r.ok){keepRt(c.rt);return send(res,200,{access_token:r.json.access_token,expires_in:r.json.expires_in})} // cookie renewed on every use
   if(r.json.error=='invalid_grant'){res.setHeader('Set-Cookie',ck('rt','',0,secure,'Strict'));return send(res,401,{error:'signed_out'})} // revoked or expired
   return send(res,502,{error:'google',detail:r.json.error});
  }
  if(a=='code'){ // the Android app's one-time code
   let b=req.body;if(typeof b=='string')try{b=JSON.parse(b)}catch(e){b=0}
   const code=b&&b.code;if(!code||typeof code!='string')return send(res,400,{error:'no_code'});
   let r;for(const ru of [undefined,'',site+'/api/auth']){ // codes from the Android sign-in carry no redirect address; try the ways Google documents
    r=await google({grant_type:'authorization_code',code,...(ru===undefined?{}:{redirect_uri:ru})});
    if(r.ok||r.json.error!='redirect_uri_mismatch')break;
   }
   if(!r.ok)return send(res,400,{error:'google',detail:r.json.error});
   if(!r.json.refresh_token)return send(res,400,{error:'no_refresh_token',hint:'Remove "Notes" at myaccount.google.com/permissions, then sign in again.'});
   keepRt(r.json.refresh_token);return send(res,200,{access_token:r.json.access_token,expires_in:r.json.expires_in});
  }
  if(a=='logout'){res.setHeader('Set-Cookie',ck('rt','',0,secure,'Strict'));return send(res,200,{ok:1})}
 }
 return send(res,405,{error:'method'});
};
