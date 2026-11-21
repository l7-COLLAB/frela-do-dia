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
function showLogin(){user=null;queue=null;$('dashboard').hidden=true;$('decisionPanel').hidden=true;$('loginPanel').hidden=false;$('logoutInLogin').hidden=true;$('retryAccess').hidden=true}
function showSession(u){user=u;$('loginPanel').hidden=true;$('dashboard').hidden=false;$('identity').textContent='Conta: '+(u.email||'usuário autenticado');$('decisionPanel').hidden=true;$('retryAccess').hidden=true}
// Managed Neon Auth pode entregar o JWT junto com a sessão (JWT plugin).
// Uma sessão válida no cookie NÃO significa que auth.token() sempre devolva data.token.
// Nunca enviar à API um token opaco de sessão ou um valor não-JWT.
function looksLikeJwt(value){
 if(typeof value!=='string'||value.length<40||value.length>8192)return false;
 const parts=value.split('.');
 return parts.length===3&&parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part));
}
async function getToken(){
 if(!auth)throw new Error('Autenticação não inicializada.');
 const current=await auth.getSession();
 if(current.error||!current.data?.user){
   throw new Error('Não foi possível confirmar sua sessão. Abra novamente o link de acesso recebido por e-mail.');
 }
 // Conforme a documentação do Neon, o JWT pode vir em data.session.token.
 const fromSession=current.data.session?.token;
 if(looksLikeJwt(fromSession))return fromSession;
 // Compatibilidade com versões do SDK que oferecem a chamada auth.token().
 let issued;
 try {issued=await auth.token();} catch(_) {issued=null;}
 if(looksLikeJwt(issued?.data?.token))return issued.data.token;
 throw new Error('O e-mail foi autenticado, mas o token de acesso à API não ficou disponível. Tente atualizar o painel. Se estiver no navegador interno do Gmail, abra o site no Safari.');
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
  $('retryAccess').hidden=false;
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
// Autenticação por e-mail e senha; criação de contas permanece desativada.
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!auth||busy)return;
 const email=$('email').value.trim(),password=$('password').value;
 if(!email||!$('email').checkValidity()||!password)return;
 setBusy(true);
 try{
  const result=await auth.signIn.email({email,password});
  if(result.error)throw new Error(result.error.message||'Não foi possível entrar.');
  $('password').value='';
  const session=await auth.getSession();
  if(session.error||!session.data?.user)throw new Error('Senha aceita, mas a sessão não pôde ser confirmada. Tente abrir o painel no Safari.');
  user=session.data.user;
  await refresh();
 }catch(e){
  status('Login não concluído: '+(e.message||'Verifique e-mail e senha.'),true);
 }finally{
  $('password').value='';
  setBusy(false);
 }
});

// Recuperação e definição de primeira senha por código enviado ao próprio e-mail.
// Nada é enviado ao backend do Frela do Dia: o Neon Auth verifica o código
// e armazena somente o hash da senha.
let lastRecoveryRequest=0;
$('toggleRecovery').addEventListener('click',()=>{
 const panel=$('recoveryPanel');
 panel.hidden=!panel.hidden;
 $('toggleRecovery').setAttribute('aria-expanded',String(!panel.hidden));
 if(!panel.hidden){
  $('recoveryEmail').value=$('email').value.trim();
  $('recoveryEmail').focus();
 }
});
$('requestRecoveryForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!auth||busy)return;
 const email=$('recoveryEmail').value.trim();
 if(!email||!$('recoveryEmail').checkValidity())return;
 if(Date.now()-lastRecoveryRequest<60000){
  status('Confira seu e-mail. Aguarde um minuto antes de solicitar outro código.');
  return;
 }
 setBusy(true);
 try{
  if(typeof auth.forgetPassword?.emailOtp!=='function'){
   throw new Error('A versão atual do módulo de autenticação não permite solicitar o código. Atualize a página.');
  }
  const result=await auth.forgetPassword.emailOtp({email});
  if(result.error)throw new Error(result.error.message||'O código não pôde ser solicitado.');
  lastRecoveryRequest=Date.now();
  $('requestRecoveryForm').hidden=true;
  $('resetPasswordForm').hidden=false;
  $('recoveryOtp').value='';
  $('newPassword').value='';
  $('confirmPassword').value='';
  status('Se a conta existir, enviaremos um código de verificação ao e-mail. Digite-o abaixo para definir sua senha.');
 }catch(err){
  status('Não foi possível solicitar o código: '+(err.message||'erro de conexão'),true);
 }finally{setBusy(false)}
});
$('backToRecovery').addEventListener('click',()=>{
 $('resetPasswordForm').hidden=true;
 $('requestRecoveryForm').hidden=false;
 $('recoveryOtp').value='';
 $('newPassword').value='';
 $('confirmPassword').value='';
 status('Você pode solicitar um novo código de verificação.');
});
$('resetPasswordForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!auth||busy)return;
 const email=$('recoveryEmail').value.trim();
 const otp=$('recoveryOtp').value.trim();
 const password=$('newPassword').value;
 const confirmation=$('confirmPassword').value;
 if(!/^[0-9]{6}$/.test(otp)){
  status('Digite os seis números do código recebido por e-mail.',true);return;
 }
 if(password.length<12||password.length>128){
  status('A senha precisa ter entre 12 e 128 caracteres.',true);return;
 }
 if(password!==confirmation){
  status('As senhas informadas não coincidem.',true);return;
 }
 setBusy(true);
 try{
  if(typeof auth.emailOtp?.resetPassword!=='function'){
   throw new Error('A atualização da senha não está disponível nesta versão do módulo.');
  }
  const result=await auth.emailOtp.resetPassword({email,otp,password});
  if(result.error)throw new Error(result.error.message||'O código pode estar incorreto ou expirado.');
  $('resetPasswordForm').reset();
  $('password').value='';
  $('recoveryPanel').hidden=true;
  $('toggleRecovery').setAttribute('aria-expanded','false');
  $('requestRecoveryForm').hidden=false;
  $('resetPasswordForm').hidden=true;
  $('email').value=email;
  status('Senha definida. Agora entre com seu e-mail e a nova senha.');
  $('password').focus();
 }catch(err){
  status('Não foi possível definir a senha: '+(err.message||'verifique o código e tente novamente'),true);
 }finally{
  $('newPassword').value='';
  $('confirmPassword').value='';
  setBusy(false);
 }
});
async function logout(){
 if(!auth)return;
 setBusy(true);try{const result=await auth.signOut();if(result?.error)throw new Error(result.error.message||'Erro ao encerrar sessão.');showLogin();$('password').value='';status('Sessão encerrada.');}
 catch(e){status('Não foi possível encerrar a sessão: '+e.message,true)}
 finally{setBusy(false)}
}
$('logout').addEventListener('click',logout);
$('logoutInLogin').addEventListener('click',logout);
$('refresh').addEventListener('click',refresh);
$('retryAccess').addEventListener('click',async()=>{
 if(!auth||busy)return;
 if(user){await refresh();return;}
 await initialize();
});
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
