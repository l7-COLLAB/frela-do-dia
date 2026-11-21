// Frela do Dia | Worker público: demo estática + painel administrativo protegido.
// A existência de /painel não concede acesso: autorização ocorre no Neon.
// O Worker nunca contém credenciais PostgreSQL, senhas de usuários ou segredos.
const ROOT='https://raw.githubusercontent.com/l7-COLLAB/frela-do-dia/main/';
const ROUTES={
 '/':'index.html',
 '/index.html':'index.html',
 '/painel':'admin/index.html',
 '/painel/':'admin/index.html',
 '/painel/app.js':'admin/app.js'
};
function headers(path){
 const admin=path.startsWith('/painel');
 const h={
  'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8',
  'Cache-Control':admin?'no-store':'public, max-age=60',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'DENY',
  'X-Robots-Tag':'noindex, nofollow'
 };
 if(admin)h['Content-Security-Policy']=
 "default-src 'none'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; "+
 "script-src 'self' https://esm.sh; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "+
 "connect-src 'self' https://esm.sh https://*.neonauth.c-16.us-east-1.aws.neon.tech https://frela-do-dia-api-dev.l7526080.workers.dev; "+
 "frame-src https://*.neonauth.c-16.us-east-1.aws.neon.tech";
 return h;
}
export default{
 async fetch(request){
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Método não permitido',{status:405,headers:{'Allow':'GET, HEAD'}});
  const url=new URL(request.url);
  const path=url.pathname;
  const target=ROUTES[path];
  if(!target)return new Response('Página não encontrada',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  try{
   const upstream=await fetch(ROOT+target,{cf:{cacheEverything:true,cacheTtl:path.startsWith('/painel')?30:120}});
   if(!upstream.ok)return new Response('Página temporariamente indisponível',{status:502});
   const h=headers(path);
   return new Response(request.method==='HEAD'?null:upstream.body,{status:200,headers:h});
  }catch(_){
   return new Response('Página temporariamente indisponível',{status:502});
  }
 }
};