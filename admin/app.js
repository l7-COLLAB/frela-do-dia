// Frela do Dia — painel restrito. A segurança está na API + RLS/RPC do Neon,
// não na visibilidade desta página nem em dados armazenados pelo navegador.
const AUTH_URL = 'https://ep-plain-mountain-bcbr91e0.neonauth.c-16.us-east-1.aws.neon.tech/frela_do_dia/auth';
const API_URL = 'https://frela-do-dia-api-dev.l7526080.workers.dev';
const $ = id => document.getElementById(id);
let auth, user=null, queue=null, currentTab='companies', decision=null, busy=false;
const categories={
 companies:{name:'Empresas',kind:'company'},
 individuals:{name:'Pessoas físicas',kind:'individual_hirer'},
 jobs:{name:'Vagas',kind:'job_posting'}
};
function status(msg,error=false){$('status').textContent=msg;$('status').classList.toggle('error',error)}
function setBusy(value){busy=value;for(const b of document.querySelectorAll('button'))b.disabled=value}
function showLogin(){user=null;queue=null;$('dashboard').hidden=true;$('decisionPanel').hidden=true;$('loginPanel').hidden=false;$('logoutInLogin').hidden=true}
function showSession(u){user=u;$('loginPanel').hidden=true;$('dashboard').hidden=false;$('identity').textContent='Conta: '+(u.email||'usuário autenticado');$('decisionPanel').hidden=true}
async function getToken(){
 if(!auth)throw new Error('Autenticação ainda não inicializada.');
 const result=await auth.token();
 if(result.error||!result.data?.token)throw new Error('Sessão expirada. Entre novamente.');
 return result.data.token;
}
async function callApi(path,{method='GET',body}={}){
 const token=await getToken();
 const response=await fetch(API_URL+path,{
   method,
   headers:{'Authorization':'Bearer '+token,'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,
   cache:'no-store',
   credentials:'omit'
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){
   if(response.status===401)throw new Error('Sessão inválida ou expirada.');
   if(response.status===403)throw new Error('Sua conta ainda não foi autorizada para administrar o Frela do Dia.');
   if(response.status===400)throw new Error('Dados inválidos para a decisão administrativa.');
   throw new Error('A operação não foi concluída (HTTP '+response.status+').');
 }
 return payload;
}
function addText(parent,tag,value,className=''){
 const el=document.createElement(tag);el.textContent=String(value??'');if(className)el.className=className;parent.append(el);return el;
}
function render(){
 if(!queue||!user)return;
 for(const [section,id] of [['companies','countCompanies'],['individuals','countIndividuals'],['jobs','countJobs']]){
   $(id).textContent=String(Array.isArray(queue[section])?queue[section].length:0);
 }
 for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===currentTab));
 const host=$('items');host.replaceChildren();
 const items=Array.isArray(queue[currentTab])?queue[currentTab]:[];
 if(!items.length){addText(host,'div','Não há solicitações pendentes nesta categoria.','empty');return;}
 for(const item of items){
  if(!item||typeof item.id!=='string')continue;
  const article=document.createElement('article');article.className='item';
  const detail=document.createElement('div');
  addText(detail,'span','AGUARDANDO REVISÃO','mini');
  addText(detail,'h3',item.title||item.display_name||'Solicitação');
  addText(detail,'p',[item.company_display_name,item.city].filter(Boolean).join(' · '));
  if(currentTab==='jobs'){
    addText(detail,'p',[item.opportunity_type==='permanent'?'Emprego fixo':item.opportunity_type==='temporary'?'Diária':'Serviço pontual',
       item.category,item.pay_cents!=null?'R$ '+(Number(item.pay_cents)/100).toFixed(2).replace('.',','):''].filter(Boolean).join(' · '));
  }else if(currentTab==='companies')addText(detail,'p',item.legal_name||'');
  const actions=document.createElement('div');actions.className='buttons';
  for(const option of [
    {label:'Aprovar',decision:currentTab==='jobs'?'published':'verified',cls:'primary'},
    {label:'Rejeitar',decision:'rejected',cls:'warning'}]){
     const btn=document.createElement('button');btn.type='button';btn.className='btn '+option.cls;
     btn.textContent=option.label;btn.addEventListener('click',()=>openDecision(item,option.decision));
     actions.append(btn);
  }
  article.append(detail,actions);host.append(article);
 }
}
function openDecision(item,action){
 if(!user||!queue||busy)return;
 const kind=categories[currentTab]?.kind;
 if(!kind||!['published','verified','rejected'].includes(action))return;
 decision={kind,id:item.id,action,label:item.title||item.display_name||'Solicitação'};
 $('decisionTitle').textContent=(action==='rejected'?'Rejeitar':'Aprovar')+' solicitação';
 $('decisionDescription').textContent=decision.label+' · '+categories[currentTab].name;
 $('justification').value='';
 $('decisionPanel').hidden=false;
 $('decisionPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
async function refresh(){
 if(!user)return;
 setBusy(true);
 try{
  const data=await callApi('/v1/admin/queue');
  if(!data||!Array.isArray(data.companies)||!Array.isArray(data.individuals)||!Array.isArray(data.jobs))throw new Error('O servidor não devolveu a fila esperada.');
  queue=data;showSession(user);render();
  status('Fila administrativa carregada. Todas as decisões exigem justificativa.');
 }catch(e){
  queue=null;$('dashboard').hidden=true;$('loginPanel').hidden=false;
  $('logoutInLogin').hidden=false;
  status(e.message||'Não foi possível carregar a administração.',true);
 }finally{setBusy(false)}
}
async function initialize(){
 try{
  // SDK oficial do Neon fornecido como módulo browser; sem segredos.
  const mod=await import('https://esm.sh/@neon/auth@0.8.2?bundle');
  if(typeof mod.createAuthClient!=='function')throw new Error('SDK indisponível.');
  auth=mod.createAuthClient(AUTH_URL);
  const result=await auth.getSession();
  if(result.error)throw new Error(result.error.message||'Erro de sessão.');
  if(result.data?.user){user=result.data.user;await refresh();}
  else{showLogin();status('Entre com uma conta administrativa previamente habilitada.');}
 }catch(e){showLogin();status('Não foi possível inicializar o Neon Auth: '+(e.message||'erro de conexão'),true)}
}
let lastMagicRequestAt=0;
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!auth||busy)return;
 const email=$('email').value.trim();
 if(!email||!$('email').checkValidity())return;
 if(Date.now()-lastMagicRequestAt<60000){
  status('Já solicitamos um link recentemente. Confira seu e-mail antes de tentar novamente.');
  return;
 }
 setBusy(true);
 try{
  const callbackURL=new URL('/painel/',window.location.origin).toString();
  const r=await auth.signIn.magicLink({email,callbackURL});
  if(r.error)throw new Error(r.error.message||'Não foi possível solicitar um link.');
  lastMagicRequestAt=Date.now();
  status('Se o e-mail estiver autorizado, você receberá um link válido por 10 minutos. Abra a mensagem para continuar.');
 }catch(e){status('Solicitação não concluída: '+(e.message||'erro de conexão'),true)}
 finally{setBusy(false)}
});
async function logout(){
 if(!auth)return;
 setBusy(true);try{await auth.signOut();showLogin();status('Sessão encerrada.');}
 catch(e){status('Não foi possível encerrar a sessão: '+e.message,true)}
 finally{setBusy(false)}
}
$('logout').addEventListener('click',logout);
$('logoutInLogin').addEventListener('click',logout);
$('refresh').addEventListener('click',refresh);
for(const btn of document.querySelectorAll('[data-tab]'))btn.addEventListener('click',()=>{
 if(!queue)return;currentTab=btn.dataset.tab;render();
});
$('cancelDecision').addEventListener('click',()=>{$('decisionPanel').hidden=true;decision=null});
$('decisionForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!decision||!user||busy)return;
 const justification=$('justification').value.trim();
 if(justification.length<10||justification.length>1200){status('Justificativa deve ter entre 10 e 1200 caracteres.',true);return}
 if(!window.confirm('Confirma esta decisão administrativa? Ela será auditada.'))return;
 setBusy(true);
 try{
  const result=await callApi('/v1/admin/decision',{
   method:'POST',
   body:{p_kind:decision.kind,p_id:decision.id,p_decision:decision.action,p_justification:justification}
  });
  if(result?.ok!==true)throw new Error('O servidor não confirmou a decisão.');
  $('decisionPanel').hidden=true;decision=null;
  status('Decisão registrada no banco de desenvolvimento.');
 }catch(err){status('Não foi possível concluir: '+(err.message||'falha'),true)}
 finally{setBusy(false)}
 if(!decision&&user)await refresh();
});
initialize();
