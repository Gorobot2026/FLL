/**
 * BIOGENESIS X3 – Cloudflare Worker, secure CORS bridge
 * Secrets (Worker Settings → Variables & Secrets → Secret):
 * GAS_URL, WORKER_SHARED_SECRET, OPERATOR_PASSWORD, MIXER_DEVICE_KEY, GREENHOUSE_DEVICE_KEY
 * Non-secret ALLOWED_ORIGIN: https://YOUR_GITHUB_NAME.github.io
 * CAUTION: use a long random operator password; this is a classroom project gateway,
 * not an enterprise identity provider. Do not expose secrets in github-pages/config.js.
 */
const UI_ACTIONS = new Set(['bootstrap','saveRecipe','mix','stop','setZone','water','saveSchedule','addExperiment','addCapsule']);
const DEVICE_ACTIONS = new Set(['devicePoll','deviceReport','telemetry']);
function response(obj,status=200,origin=''){
  const h={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(origin){h['Access-Control-Allow-Origin']=origin;h['Vary']='Origin';h['Access-Control-Allow-Headers']='Content-Type, X-Operator-Key, X-Device-Key';h['Access-Control-Allow-Methods']='POST, OPTIONS';}
  return new Response(JSON.stringify(obj),{status,headers:h});
}
function sameKey(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  const size=Math.max(a.length,b.length);let d=a.length^b.length;
  for(let i=0;i<size;i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return d===0;
}
function b64url(bytes){let s='';for(const byte of new Uint8Array(bytes))s+=String.fromCharCode(byte);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function sign(value,secret){
  const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
async function forward(action,data,env){
  const ts=Date.now(),nonce=crypto.randomUUID().replace(/-/g,'');
  const canonical=action+'\n'+ts+'\n'+nonce+'\n'+JSON.stringify(data||{});
  const signature=await sign(canonical,env.WORKER_SHARED_SECRET);
  const res=await fetch(env.GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,data,ts,nonce,signature}),redirect:'follow'});
  const text=await res.text();
  let payload;try{payload=JSON.parse(text);}catch(e){throw Error('Google Apps Script returned non-JSON (verify deployment and access) HTTP '+res.status);}
  return payload;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin')||'';
    const allowed=String(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
    const ui=url.pathname==='/api',device=url.pathname==='/device';
    if(!ui&&!device)return response({ok:false,error:'Endpoint not found'},404);
    const cors=ui&&origin===allowed?origin:'';
    if(request.method==='OPTIONS'){
      if(!ui||!cors)return response({ok:false,error:'Origin not allowed'},403);
      return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Operator-Key','Access-Control-Max-Age':'600','Vary':'Origin'}});
    }
    if(request.method!=='POST')return response({ok:false,error:'POST only'},405,cors);
    if(ui&&origin!==allowed)return response({ok:false,error:'Origin not allowed'},403,cors);
    const required=['GAS_URL','WORKER_SHARED_SECRET','OPERATOR_PASSWORD','MIXER_DEVICE_KEY','GREENHOUSE_DEVICE_KEY'];
    if(required.some(k=>!env[k])||!allowed)return response({ok:false,error:'Worker setup incomplete'},503,cors);
    const pw=request.headers.get(ui?'X-Operator-Key':'X-Device-Key');
    if(ui&&!sameKey(pw,env.OPERATOR_PASSWORD))return response({ok:false,error:'Invalid operator password'},401,cors);
    if(!ui&&!pw)return response({ok:false,error:'Missing device key'},401);
    if(Number(request.headers.get('content-length')||0)>12000)return response({ok:false,error:'Payload too large'},413,cors);
    let body;
    try{const raw=await request.text();if(raw.length>12000)throw Error('Too large');body=JSON.parse(raw);}catch(e){return response({ok:false,error:'Invalid JSON'},400,cors);}
    if(!body||typeof body.action!=='string'||typeof body.data!=='object'||body.data===null||Array.isArray(body.data))return response({ok:false,error:'Malformed request'},400,cors);
    if(ui&&!UI_ACTIONS.has(body.action)||device&&!DEVICE_ACTIONS.has(body.action))return response({ok:false,error:'Action not allowed'},403,cors);
    if(device){
      const d=String(body.data.device||'');
      if(!['mixer','greenhouse'].includes(d))return response({ok:false,error:'Bad device'},400);
      const expected=d==='mixer'?env.MIXER_DEVICE_KEY:env.GREENHOUSE_DEVICE_KEY;
      if(!sameKey(pw,expected))return response({ok:false,error:'Invalid device key'},401);
    }
    try{
      const result=await forward(body.action,body.data,env);
      return response(result,result.ok?200:400,cors);
    }catch(e){return response({ok:false,error:'Upstream unavailable: '+String(e.message).slice(0,150)},502,cors);}
  }
};
