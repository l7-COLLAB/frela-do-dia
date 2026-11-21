// Frela do Dia — API de desenvolvimento, somente leitura.
// NÃO usa conexão privilegiada. O Neon Data API valida JWTs e aplica RLS.
// NÃO publicar alterações administrativas neste Worker sem revisão de segurança.
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
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
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
      if(!ROUTES[url.pathname]&&url.pathname!=='/health')return respond({error:'not_found'},404,origin);
      return new Response(null,{status:204,headers:cors(origin)});
    }
    if(request.method!=='GET')return respond({error:'method_not_allowed'},405,origin);
    if(url.pathname==='/health'){
      return respond({service:'frela-do-dia-api-dev',status:'ok',environment:'development',writable:false},200,origin);
    }
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
