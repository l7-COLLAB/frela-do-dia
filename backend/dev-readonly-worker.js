// Frela do Dia — API de desenvolvimento: consultas + decisões administrativas.
 // Não usa conexão privilegiada. A Neon Data API autentica JWTs e as RPCs
 // verificam identidade na allowlist app_private.admin_operators (vazia inicialmente).
 // Não há endpoints públicos de escrita nem cadastro.
const NEON_DATA_API = 'https://ep-plain-mountain-bcbr91e0.apirest.c-16.us-east-1.aws.neon.tech/frela_do_dia/rest/v1';
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'https://frela-do-dia.l7526080.workers.dev'
]);
const ROUTES = Object.freeze({
  '/v1/jobs': {
    table: 'job_postings',
    select: 'id,title,company_display_name,city,district,category,starts_at,ends_at,pay_cents,pay_period,opportunity_type,slots,filled_slots',
    public: true
  },
  '/v1/me/worker': {
    table: 'worker_profiles',
    select: 'user_id,display_name,city,bio',
    public: false
  },
  '/v1/me/company': {
    table: 'companies',
    select: 'id,display_name,city,verification_state',
    public: false
  },
  '/v1/me/individual': {
    table: 'individual_hirers',
    select: 'id,display_name,city,verification_state',
    public: false
  }
});
function cors(origin) {
  const headers = {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'",
    'Vary':'Origin'
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}
function respond(body,status=200,origin=null) {
  return new Response(JSON.stringify(body), {status,headers:cors(origin)});
}
export default {
  async fetch(request) {
    const url=new URL(request.url);
    const origin=request.headers.get('Origin');
    const originAllowed=!origin||ALLOWED_ORIGINS.has(origin);
    if(!originAllowed) return respond({error:'origin_not_allowed'},403);
    if(request.method==='OPTIONS'){
      if(!ROUTES[url.pathname]&&url.pathname!=='/health'&&url.pathname!=='/v1/admin/queue'&&url.pathname!=='/v1/admin/decision')return respond({error:'not_found'},404,origin);
      return new Response(null,{status:204,headers:cors(origin)});
    }
    if(url.pathname==='/health'&&request.method==='GET'){
      return respond({service:'frela-do-dia-api-dev',status:'ok',environment:'development',publicWrites:false,adminRequiresAuthorization:true},200,origin);
    }
    const isAdminQueue=url.pathname==='/v1/admin/queue';
    const isAdminDecision=url.pathname==='/v1/admin/decision';
    if(isAdminQueue||isAdminDecision){
      if(isAdminQueue&&request.method!=='GET')return respond({error:'method_not_allowed'},405,origin);
      if(isAdminDecision&&request.method!=='POST')return respond({error:'method_not_allowed'},405,origin);
      const token=request.headers.get('Authorization')||'';
      if(!/^Bearer [^\\s]+$/.test(token)||token.length<40||token.length>8192)
        return respond({error:'authentication_required'},401,origin);
      let rpcBody={};
      if(isAdminDecision){
        const len=Number(request.headers.get('Content-Length')||0);
        if(len>3200)return respond({error:'payload_too_large'},413,origin);
        try {
          const raw=await request.text();
          if(raw.length>3200) return respond({error:'payload_too_large'},413,origin);
          const obj=JSON.parse(raw);
          if(!obj||Array.isArray(obj)||typeof obj!=='object')throw Error('bad_json');
          if(Object.keys(obj).sort().join(',')!=='p_decision,p_id,p_justification,p_kind')throw Error('unexpected_fields');
          if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(obj.p_id||''))throw Error('bad_id');
          if(!['company','individual_hirer','job_posting'].includes(obj.p_kind))throw Error('bad_kind');
          if(!(['company','individual_hirer'].includes(obj.p_kind)?
                 ['verified','rejected','suspended'].includes(obj.p_decision):
                 ['published','rejected'].includes(obj.p_decision)))throw Error('bad_decision');
          if(typeof obj.p_justification!=='string'||obj.p_justification.trim().length<10||obj.p_justification.length>1200)throw Error('bad_reason');
          rpcBody={p_kind:obj.p_kind,p_id:obj.p_id,p_decision:obj.p_decision,p_justification:obj.p_justification.trim()};
        }catch(_){return respond({error:'invalid_request'},400,origin)}
      }
      const rpc=isAdminQueue?'frela_admin_queue':'frela_admin_decide';
      try {
        const upstream=await fetch(NEON_DATA_API+'/rpc/'+rpc,{
          method:'POST',
          headers:{'Authorization':token,'Accept':'application/json','Content-Type':'application/json'},
          body:JSON.stringify(rpcBody),
          cache:'no-store',
          signal:AbortSignal.timeout(8000)
        });
        if(upstream.status===401)return respond({error:'unauthorized'},401,origin);
        if(upstream.status===403)return respond({error:'forbidden'},403,origin);
        if(upstream.status===400||upstream.status===409)return respond({error:'invalid_transition_or_request'},409,origin);
        if(!upstream.ok)return respond({error:'database_unavailable'},502,origin);
        const data=await upstream.json();
        if(!data||typeof data!=='object'||Array.isArray(data))return respond({error:'unexpected_database_response'},502,origin);
        if(isAdminQueue&&(!Array.isArray(data.companies)||!Array.isArray(data.individuals)||!Array.isArray(data.jobs)))return respond({error:'unexpected_database_response'},502,origin);
        return respond(data,200,origin);
      }catch(_){return respond({error:'temporarily_unavailable'},502,origin)}
    }
    if(request.method!=='GET')return respond({error:'method_not_allowed'},405,origin);
    const route=ROUTES[url.pathname];
    if(!route)return respond({error:'not_found'},404,origin);
    const auth=request.headers.get('Authorization')||'';
    if(!route.public && (!auth.startsWith('Bearer ')||auth.length>8192||auth.length<40)){
      return respond({error:'authentication_required'},401,origin);
    }
    const params=new URLSearchParams({
      select: route.select,
      limit: '20',
    });
    if(route.public) params.set('order','starts_at.asc');
    const upstreamUrl=NEON_DATA_API+'/'+route.table+'?'+params.toString();
    try{
      const headers={'Accept':'application/json'};
      if(!route.public)headers.Authorization=auth;
      const upstream=await fetch(upstreamUrl,{method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(upstream.status===401)return respond({error:'unauthorized'},401,origin);
      if(upstream.status===403)return respond({error:'forbidden'},403,origin);
      if(!upstream.ok)return respond({error:'database_unavailable'},502,origin);
      const payload=await upstream.json();
      if(!Array.isArray(payload))return respond({error:'unexpected_database_response'},502,origin);
      return respond({items:payload,count:payload.length},200,origin);
    }catch(_){
      // Nunca enviar ao cliente URL interna, JWT, SQL ou erro detalhado do banco.
      return respond({error:'temporarily_unavailable'},502,origin);
    }
  }
};
