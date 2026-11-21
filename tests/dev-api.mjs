import { strict as assert } from 'node:assert';
import api from '../backend/dev-readonly-worker.js';

const base = 'https://frela-do-dia-api-dev.test';
const realFetch = globalThis.fetch;
let outgoing = [];
globalThis.fetch = async (url, options={}) => {
  outgoing.push({url:String(url), options});
  return Response.json([{id:'fixture-only',title:'Oportunidade demonstrativa'}]);
};

try {
  let response=await api.fetch(new Request(base+'/health'));
  assert.equal(response.status,200);
  let data=await response.json();
  assert.equal(data.environment,'development');
  assert.equal(data.publicWrites,false);
  assert.equal(data.adminRequiresAuthorization,true);
  assert.equal(outgoing.length,0);

  response=await api.fetch(new Request(base+'/v1/jobs'));
  assert.equal(response.status,200);
  data=await response.json();
  assert.equal(data.items.length,1);
  assert.match(outgoing[0].url,/job_postings/);
  assert.equal(outgoing[0].options.headers.Authorization,undefined);

  outgoing=[];
  response=await api.fetch(new Request(base+'/v1/me/worker'));
  assert.equal(response.status,401);
  assert.equal(outgoing.length,0);

  response=await api.fetch(new Request(base+'/v1/me/worker',{headers:{Authorization:'Bearer '+('a'.repeat(80))}}));
  assert.equal(response.status,200);
  assert.equal(outgoing.length,1);
  assert.match(outgoing[0].url,/worker_profiles/);
  assert.equal(outgoing[0].options.headers.Authorization,'Bearer '+('a'.repeat(80)));
  assert.doesNotMatch(JSON.stringify(await response.json()),/Bearer a/);

  outgoing=[];
  response=await api.fetch(new Request(base+'/v1/jobs',{headers:{Origin:'https://untrusted.example'}}));
  assert.equal(response.status,403);
  assert.equal(outgoing.length,0);

  response=await api.fetch(new Request(base+'/v1/jobs',{headers:{Origin:'http://localhost:5173'}}));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'http://localhost:5173');

  response=await api.fetch(new Request(base+'/v1/me/worker',{method:'OPTIONS',headers:{Origin:'http://localhost:5173'}}));
  assert.equal(response.status,204);

  response=await api.fetch(new Request(base+'/v1/jobs',{method:'POST'}));
  assert.equal(response.status,405);


  // Admin sem JWT não pode consultar nem decidir.
  outgoing=[];
  response=await api.fetch(new Request(base+'/v1/admin/queue'));
  assert.equal(response.status,401);
  response=await api.fetch(new Request(base+'/v1/admin/decision',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({p_kind:'company',p_id:'00000000-0000-4000-8000-000000000001',p_decision:'verified',p_justification:'Verificação administrativa'})
  }));
  assert.equal(response.status,401);
  assert.equal(outgoing.length,0);

  const token='Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.signatureWithsValidCharacters';
  response=await api.fetch(new Request(base+'/v1/admin/decision',{
    method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},
    body:JSON.stringify({p_kind:'company',p_id:'00000000-0000-4000-8000-000000000001',p_decision:'published',p_justification:'Esta combinação é inválida'})
  }));
  assert.equal(response.status,400);
  assert.equal(outgoing.length,0);

  globalThis.fetch=async(url,options={})=>{
    outgoing.push({url:String(url),options});
    if(String(url).includes('frela_admin_queue'))return Response.json({companies:[],individuals:[],jobs:[]});
    return Response.json({ok:true,kind:'company',decision:'verified'});
  };
  outgoing=[];
  response=await api.fetch(new Request(base+'/v1/admin/queue',{headers:{Authorization:token}}));
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).companies,[]);
  assert.match(outgoing[0].url,/rpc\/frela_admin_queue/);
  assert.equal(outgoing[0].options.headers.Authorization,token,'JWT com letra s deve chegar sem alteração ao Neon');
  assert.equal(outgoing[0].options.method,'POST');

  outgoing=[];
  response=await api.fetch(new Request(base+'/v1/admin/decision',{
    method:'POST',headers:{Authorization:token,'Content-Type':'application/json',Origin:'https://frela-do-dia.l7526080.workers.dev'},
    body:JSON.stringify({p_kind:'company',p_id:'00000000-0000-4000-8000-000000000001',p_decision:'verified',p_justification:'Documentação conferida para cadastro'})
  }));
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
  assert.match(outgoing[0].url,/rpc\/frela_admin_decide/);

  response=await api.fetch(new Request(base+'/v1/unknown'));
  assert.equal(response.status,404);

  globalThis.fetch=async()=>new Response('Sensitive upstream error', {status:500});
  response=await api.fetch(new Request(base+'/v1/jobs'));
  assert.equal(response.status,502);
  assert.doesNotMatch(await response.text(),/Sensitive upstream error/);

  console.log('OK: API dev - saúde, vagas, RLS delegada, token obrigatório, CORS, métodos e erros controlados.');
} finally {
  globalThis.fetch=realFetch;
}
