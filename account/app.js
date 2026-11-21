// Frela do Dia — conta de homologação.
// Login pelo Neon Auth e dados pela Neon Data API, com RLS por titular.
// A publicação de novos cadastros permanece BLOQUEADA no servidor Neon Auth.
// Nenhuma senha, token ou código OTP é armazenado pelo app.
const AUTH_URL='https://ep-plain-mountain-bcbr91e0.neonauth.c-16.us-east-1.aws.neon.tech/frela_do_dia/auth';
const API_URL='https://frela-do-dia-api-dev.l7526080.workers.dev';
// Dois bloqueios independentes: cadastro público só pode abrir após termos,
// privacidade, antifraude, migração de produção e liberação do Neon Auth.
const PUBLIC_SIGNUPS_OPEN=false;
const LEGAL_DOCUMENTS_READY=false;
const $=id=>document.getElementById(id);
let auth=null,activeUser=null,account=null,selectedKind='worker',busy=false,lastRecovery=0;
const accountRoutes={
  worker:'/v1/account/worker',
  individual:'/v1/account/individual',
  company:'/v1/account/company'
};
function report(message,error=false){
 $('status').textContent=message;
 $('status').classList.toggle('error',!!error);
}
function setBusy(value){
 busy=!!value;
 for(const button of document.querySelectorAll('button:not([disabled])')){
  if(value){button.disabled=true;button.dataset.tempDisabled='true'}
 }
 if(!value){
  for(const button of document.querySelectorAll('button[data-temp-disabled]')){
   button.disabled=false;delete button.dataset.tempDisabled;
  }
 }
}
function textChild(parent,tag,value,cls=''){
 const child=document.createElement(tag);
 child.textContent=String(value??'');
 if(cls)child.className=cls;
 parent.append(child);
 return child;
}
function looksLikeJwt(value){
 return typeof value==='string'&&value.length>=40&&value.length<=8192
   &&value.split('.').length===3&&value.split('.').every(part=>/^[A-Za-z0-9_-]+$/.test(part));
}
async function getJwt(){
 if(!auth)throw new Error('Autenticação indisponível.');
 const current=await auth.getSession();
 if(current.error||!current.data?.user)throw new Error('Sua sessão não está mais ativa. Entre novamente.');
 const fromSession=current.data.session?.token;
 if(looksLikeJwt(fromSession))return fromSession;
 const result=await auth.token();
 if(result.error||!looksLikeJwt(result.data?.token))
  throw new Error('Não foi possível obter um token válido. Entre novamente.');
 return result.data.token;
}
async function api(path,body){
 const token=await getJwt();
 const response=await fetch(API_URL+path,{
  method:body===undefined?'GET':'POST',
  headers:{
   Authorization:'Bearer '+token,
   Accept:'application/json',
   ...(body===undefined?{}:{'Content-Type':'application/json'})
  },
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  cache:'no-store',credentials:'omit'
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){
  if(response.status===401)throw new Error('Sessão não autorizada. Entre novamente.');
  if(response.status===403)throw new Error('Acesso não permitido para sua conta.');
  if(response.status===409)throw new Error('Este cadastro já existe ou os dados não atendem aos requisitos. Atualize seu perfil.');
  if(response.status===400)throw new Error('Revise os dados preenchidos.');
  throw new Error('Não foi possível consultar o servidor (HTTP '+response.status+').');
 }
 return payload;
}
function showSignedOut(){
 activeUser=null;account=null;
 $('authPanel').hidden=false;
 $('accountPanel').hidden=true;
 $('loginPassword').value='';
 // Evita que dados da conta anterior permaneçam em campos de um dispositivo compartilhado.
 for(const id of ['workerForm','individualForm','companyForm']){
  $(id).reset();
 }
 $('profileCards').replaceChildren();
 $('individualSubmit').disabled=false;
 $('companySubmit').disabled=false;
}
function showSignedIn(user){
 activeUser=user;
 $('authPanel').hidden=true;
 $('accountPanel').hidden=false;
 $('sessionIdentity').textContent='Sessão: '+(user.email||'conta autenticada');
 $('loginPassword').value='';
}
function showKind(kind){
 if(!accountRoutes[kind])return;
 selectedKind=kind;
 for(const button of document.querySelectorAll('[data-kind]')){
  button.setAttribute('aria-selected',String(button.dataset.kind===kind));
 }
 for(const value of Object.keys(accountRoutes))$(value+'Form').hidden=value!==kind;
}
function card(parent,title,detail,extra){
 const node=document.createElement('div');node.className='record';
 textChild(node,'h3',title);
 textChild(node,'p',detail);
 if(extra)textChild(node,'p',extra);
 parent.append(node);
}
function renderAccount(){
 const host=$('profileCards');host.replaceChildren();
 if(!account){
  card(host,'Perfil indisponível','Não foi possível consultar os perfis. Tente Atualizar.');
  return;
 }
 const worker=account.worker;
 if(worker){
  card(host,'Trabalhador',worker.display_name+' · '+worker.city,
   'Cadastro salvo. Você poderá editar seu perfil nesta área.');
  $('workerName').value=worker.display_name||'';
  $('workerCity').value=worker.city||'';
  $('workerBio').value=worker.bio||'';
  $('workerAvailability').value=worker.availability||'';
 }else card(host,'Trabalhador','Nenhum perfil salvo.');
 const individual=account.individual;
 if(individual){
  card(host,'Contratante pessoa física',individual.display_name+' · '+individual.city,
   'Verificação: '+(individual.verification_state==='pending'?'pendente':individual.verification_state));
  $('individualSubmit').disabled=true;
  $('individualSubmit').textContent='Cadastro já solicitado';
 }else{
  card(host,'Contratante pessoa física','Nenhum cadastro solicitado.');
  $('individualSubmit').disabled=false;
  $('individualSubmit').textContent='Solicitar cadastro de pessoa física';
 }
 const company=account.company;
 if(company){
  card(host,'Empresa',company.display_name+' · '+company.city,
   'Verificação: '+(company.verification_state==='pending'?'pendente':company.verification_state));
  $('companySubmit').disabled=true;
  $('companySubmit').textContent='Cadastro já solicitado';
 }else{
  card(host,'Empresa','Nenhuma empresa cadastrada.');
  $('companySubmit').disabled=false;
  $('companySubmit').textContent='Solicitar cadastro de empresa';
 }
}
async function refreshAccount(){
 if(!activeUser)return;
 setBusy(true);
 try{
  const result=await api('/v1/account');
  if(!result||!('worker' in result)||!('company' in result)||!('individual' in result))
   throw new Error('Resposta de perfil inválida.');
  account=result;
  renderAccount();
  report('Dados carregados do Neon. Este é um ambiente de homologação.');
 }catch(error){
  account=null;renderAccount();
  report('Sua sessão permanece ativa, mas o perfil não carregou: '+(error.message||'falha'),true);
 }finally{setBusy(false)}
}
async function save(kind,data){
 if(busy||!activeUser)return;
 setBusy(true);
 try{
  const result=await api(accountRoutes[kind],data);
  if(result?.saved!==true)throw new Error('O servidor não confirmou o cadastro.');
  report(kind==='worker'?'Perfil de trabalhador salvo.':'Solicitação de contratante registrada como pendente.');
 }catch(error){report(error.message||'Não foi possível salvar.',true);setBusy(false);return}
 setBusy(false);
 await refreshAccount();
}
// Formulário de inscrição já implementado, mas com dois bloqueios explícitos.
// Não substituir esta guarda por um botão visual: o Neon também proíbe sign-up.
let pendingSignupEmail='';
$('signupForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!PUBLIC_SIGNUPS_OPEN||!LEGAL_DOCUMENTS_READY||!auth||busy){
  report('Os cadastros públicos ainda não foram liberados.',true);
  return;
 }
 const name=$('signupName').value.trim();
 const email=$('signupEmail').value.trim();
 const password=$('signupPassword').value;
 if(name.length<2||password.length<12||password!==$('signupConfirm').value){
  report('Confira o nome e confirme a senha de pelo menos 12 caracteres.',true);
  return;
 }
 setBusy(true);
 try{
  const r=await auth.signUp.email({name,email,password});
  if(r.error)throw new Error(r.error.message||'Não foi possível criar a conta.');
  pendingSignupEmail=email;
  $('signupPassword').value='';$('signupConfirm').value='';
  $('signupForm').hidden=true;$('verifySignupForm').hidden=false;
  report('Solicitamos a verificação por e-mail. Digite o código recebido para concluir.');
 }catch(error){report('Cadastro não concluído: '+(error.message||'erro'),true)}
 finally{$('signupPassword').value='';$('signupConfirm').value='';setBusy(false)}
});
$('verifySignupForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!PUBLIC_SIGNUPS_OPEN||!LEGAL_DOCUMENTS_READY||!auth||busy||!pendingSignupEmail){
  report('Verificação de novas inscrições indisponível.',true);return;
 }
 const otp=$('signupOtp').value.trim();
 if(!/^[0-9]{6}$/.test(otp)){report('O código precisa ter seis números.',true);return}
 setBusy(true);
 try{
  const r=await auth.emailOtp.verifyEmail({email:pendingSignupEmail,otp});
  if(r.error)throw new Error(r.error.message||'Código inválido.');
  $('signupOtp').value='';
  $('verifySignupForm').hidden=true;$('signupForm').hidden=false;
  $('signupPanel').hidden=true;
  $('loginEmail').value=pendingSignupEmail;pendingSignupEmail='';
  report('E-mail verificado. Agora você pode entrar com sua senha.');
 }catch(error){report('Não foi possível confirmar o e-mail: '+(error.message||'falha'),true)}
 finally{setBusy(false)}
});

$('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!auth)return;
 const email=$('loginEmail').value.trim();
 const password=$('loginPassword').value;
 setBusy(true);
 try{
  const response=await auth.signIn.email({email,password});
  if(response.error)throw new Error(response.error.message||'E-mail ou senha incorretos.');
  const current=await auth.getSession();
  if(current.error||!current.data?.user)throw new Error('O login não pôde ser confirmado.');
  showSignedIn(current.data.user);
  report('Login confirmado. Carregando seu cadastro…');
 }catch(error){report('Não foi possível entrar: '+(error.message||'erro desconhecido'),true);setBusy(false);$('loginPassword').value='';return}
 setBusy(false);
 await refreshAccount();
});
$('logout').addEventListener('click',async()=>{
 if(busy||!auth)return;
 setBusy(true);
 try{
  const result=await auth.signOut();
  if(result.error)throw new Error(result.error.message||'Não foi possível encerrar sessão.');
  showSignedOut();
  report('Sessão encerrada.');
 }catch(error){report(error.message||'Erro ao sair.',true)}
 finally{setBusy(false)}
});
$('refreshAccount').addEventListener('click',refreshAccount);
for(const button of document.querySelectorAll('[data-kind]')){
 button.addEventListener('click',()=>showKind(button.dataset.kind));
}
$('workerForm').addEventListener('submit',event=>{
 event.preventDefault();
 save('worker',{
  p_display_name:$('workerName').value.trim(),
  p_city:$('workerCity').value.trim(),
  p_bio:$('workerBio').value.trim()||null,
  p_availability:$('workerAvailability').value.trim()||null
 });
});
$('individualForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(account?.individual)return;
 save('individual',{p_display_name:$('individualName').value.trim(),p_city:$('individualCity').value.trim()});
});
$('companyForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(account?.company)return;
 save('company',{
  p_legal_name:$('companyLegal').value.trim(),
  p_display_name:$('companyName').value.trim(),
  p_city:$('companyCity').value.trim()
 });
});
$('toggleRecovery').addEventListener('click',()=>{
 $('recoveryPanel').hidden=!$('recoveryPanel').hidden;
 $('toggleRecovery').setAttribute('aria-expanded',String(!$('recoveryPanel').hidden));
 if(!$('recoveryPanel').hidden)$('recoveryEmail').value=$('loginEmail').value.trim();
});
$('recoveryRequest').addEventListener('submit',async event=>{
 event.preventDefault();if(!auth||busy)return;
 if(Date.now()-lastRecovery<60000){report('Aguarde um minuto antes de pedir outro código.');return}
 setBusy(true);
 try{
  const email=$('recoveryEmail').value.trim();
  const r=await auth.forgetPassword.emailOtp({email});
  if(r.error)throw new Error(r.error.message||'Não foi possível solicitar código.');
  lastRecovery=Date.now();
  $('recoveryRequest').hidden=true;$('recoveryReset').hidden=false;
  report('Se esta conta existir, enviaremos um código para o e-mail informado.');
 }catch(error){report('Erro na recuperação: '+(error.message||'falha'),true)}
 finally{setBusy(false)}
});
$('recoveryReset').addEventListener('submit',async event=>{
 event.preventDefault();if(!auth||busy)return;
 const otp=$('recoveryOtp').value.trim();
 const password=$('recoveryPassword').value;
 if(!/^[0-9]{6}$/.test(otp)||password.length<12||password!==$('recoveryConfirm').value){
  report('Confira o código e digite duas vezes uma senha de pelo menos 12 caracteres.',true);return;
 }
 setBusy(true);
 try{
  const email=$('recoveryEmail').value.trim();
  const response=await auth.emailOtp.resetPassword({email,otp,password});
  if(response.error)throw new Error(response.error.message||'Código inválido ou expirado.');
  $('recoveryPassword').value='';$('recoveryConfirm').value='';$('recoveryOtp').value='';
  $('recoveryPanel').hidden=true;$('recoveryReset').hidden=true;$('recoveryRequest').hidden=false;
  $('loginEmail').value=email;
  report('Senha definida. Entre com seu e-mail e a nova senha.');
 }catch(error){report('Não foi possível redefinir a senha: '+(error.message||'erro'),true)}
 finally{$('recoveryPassword').value='';$('recoveryConfirm').value='';setBusy(false)}
});
async function initialize(){
 // O botão permanece desativado enquanto o Neon não permite sign-up.
 // A interface futura só abrirá com a configuração legal/técnica concluída.
 if(PUBLIC_SIGNUPS_OPEN&&LEGAL_DOCUMENTS_READY){
  $('signupLocked').disabled=false;
  $('signupLocked').removeAttribute('aria-disabled');
  $('signupLocked').textContent='Criar conta';
  $('signupLocked').addEventListener('click',()=>{
   $('signupPanel').hidden=!$('signupPanel').hidden;
  });
 }
 try{
  const sdk=await import('https://esm.sh/@neon/auth@0.8.2?bundle');
  if(typeof sdk.createAuthClient!=='function')throw new Error('SDK de autenticação indisponível.');
  auth=sdk.createAuthClient(AUTH_URL);
  const current=await auth.getSession();
  if(current.error)throw new Error(current.error.message||'Falha ao verificar sessão.');
  if(current.data?.user){showSignedIn(current.data.user);await refreshAccount();}
  else{showSignedOut();report('Acesse com uma conta já autorizada para homologação.');}
 }catch(error){showSignedOut();report('Não foi possível inicializar o login: '+(error.message||'erro de conexão'),true)}
}
initialize();
