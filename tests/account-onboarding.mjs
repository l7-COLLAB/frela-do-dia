import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import api from '../backend/dev-readonly-worker.js';

const html=readFileSync(new URL('../account/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../account/app.js',import.meta.url),'utf8');
const edge=readFileSync(new URL('../backend/public-site-worker.js',import.meta.url),'utf8');
const db=readFileSync(new URL('../database/migrations/0009_account_onboarding.sql',import.meta.url),'utf8');
for(const id of ['loginForm','authPanel','accountPanel','workerForm','individualForm','companyForm','recoveryRequest','recoveryReset','signupLocked','status']){
 assert.ok(html.includes('id="'+id+'"'),'Campo ausente: '+id);
}
assert.match(html,/Inscrições públicas ainda não liberadas/);
assert.match(html,/disabled aria-disabled="true"/);
assert.match(script,/auth\.signIn\.email/);
assert.match(script,/auth\.getSession/);
assert.match(script,/auth\.signOut/);
assert.match(script,/accountRoutes/);
assert.doesNotMatch(script,/auth\.signUp\.email/,'Signup público ainda não deve estar ativado');
assert.doesNotMatch(script,/localStorage\.setItem|sessionStorage\.setItem/);
assert.match(edge,/'\/conta\/':'account\/index\.html'/);
assert.match(edge,/'\/conta\/app\.js':'account\/app\.js'/);
assert.match(db,/SECURITY INVOKER SET search_path=pg_catalog/);
assert.match(db,/CREATE UNIQUE INDEX companies_single_account_idx/);
assert.doesNotMatch(db,/GRANT EXECUTE ON FUNCTION public\.frela_account_self\(\) TO anonymous/);

const original=globalThis.fetch;
const calls=[];
const base='https://frela-do-dia-api-dev.test';
const jwt='Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.signatureWithsInToken';
globalThis.fetch=async(url,opts={})=>{
 calls.push({url:String(url),opts});
 if(String(url).endsWith('frela_account_self'))
  return Response.json({worker:null,company:null,individual:null});
 return Response.json({saved:true,profile:'worker'});
};
try{
 let r=await api.fetch(new Request(base+'/v1/account'));
 assert.equal(r.status,401);
 assert.equal(calls.length,0);
 r=await api.fetch(new Request(base+'/v1/account',{headers:{Authorization:jwt}}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).company,null);
 assert.match(calls.at(-1).url,/rpc\/frela_account_self$/);
 assert.equal(calls.at(-1).opts.headers.Authorization,jwt);
 const valid={p_display_name:'Pessoa Teste',p_city:'Ijuí',p_bio:null,p_availability:'Sábado'};
 r=await api.fetch(new Request(base+'/v1/account/worker',{method:'POST',headers:{Authorization:jwt,'Content-Type':'application/json'},body:JSON.stringify(valid)}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).saved,true);
 assert.deepEqual(JSON.parse(calls.at(-1).opts.body),valid);
 assert.match(calls.at(-1).url,/rpc\/frela_account_save_worker$/);
 const before=calls.length;
 r=await api.fetch(new Request(base+'/v1/account/company',{method:'POST',headers:{Authorization:jwt,'Content-Type':'application/json'},body:JSON.stringify({p_legal_name:'Teste Ltda',p_display_name:'Teste',p_city:'Ijuí',owner_user_id:'hacker'})}));
 assert.equal(r.status,400);
 assert.equal(calls.length,before);
 r=await api.fetch(new Request(base+'/v1/account/worker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(valid)}));
 assert.equal(r.status,401);
 assert.equal(calls.length,before);
 r=await api.fetch(new Request(base+'/v1/account/worker',{method:'POST',headers:{Authorization:jwt,'Content-Type':'application/json'},body:JSON.stringify({...valid,p_display_name:'x'})}));
 assert.equal(r.status,400);
 assert.equal(calls.length,before);
 r=await api.fetch(new Request(base+'/v1/account',{headers:{Origin:'https://other-domain.invalid',Authorization:jwt}}));
 assert.equal(r.status,403);
 assert.equal(calls.length,before);
 console.log('OK: perfis autenticados, payload allowlist, bloqueios e UI fechada a inscrições públicas.');
}finally{globalThis.fetch=original}
