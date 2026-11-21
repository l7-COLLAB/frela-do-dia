// Frela do Dia — painel restrito. A segurança está na API + RLS/RPC do Neon,
// não na visibilidade desta página nem em dados armazenados pelo navegador.
const AUTH_URL = 'https://ep-plain-mountain-bcbr91e0.neonauth.c-16.us-east-1.aws.neon.tech/frela_do_dia/auth';
const API_URL = 'https://frela-do-dia-api-dev.l7526080.workers.dev';
const $ = id => document.getElementById(id);
let auth, user=null, queue=null, commercial=null, currentTab='companies', currentSection='overview', decision=null, busy=false;
const categories={
 companies:{name:'Empresas',kind:'company'},
 individuals:{name:'Pessoas físicas',kind:'individual_hirer'},
 jobs:{name:'Vagas',kind:'job_posting'}
};
function status(msg,error=false){$('status').textContent=msg;$('status').classList.toggle('error',error)}
function setBusy(value){busy=value;for(const b of document.querySelectorAll('button'))b.disabled=value}
function showLogin(){user=null;queue=null;commercial=null;$('dashboard').hidden=true;$('decisionPanel').hidden=true;$('loginPanel').hidden=false;$('logoutInLogin').hidden=true;$('retryAccess').hidden=true}
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
   throw new Error('Não foi possível confirmar sua sessão. Entre novamente com e-mail e senha.');
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
   if(response.status===401){
     if(payload?.error==='token_rejected_by_neon'){
       throw new Error('Sua sessão foi reconhecida, mas o Neon recusou o token de acesso. Saia da conta e entre novamente com e-mail e senha.');
     }
     if(payload?.error==='authentication_required'){
       throw new Error('A API não recebeu um token de autenticação válido. Entre novamente com e-mail e senha.');
     }
     throw new Error('A autenticação não foi aceita pela API. Saia e entre novamente.');
   }
   if(response.status===403)throw new Error('Sua conta ainda não foi autorizada para administrar o Frela do Dia.');
   if(response.status===400)throw new Error('Dados inválidos para a decisão administrativa.');
   if(response.status===409)throw new Error('Este registro foi alterado ou não pode receber a ação. Atualize os dados e tente novamente.');
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

const moneyBRL = cents => new Intl.NumberFormat('pt-BR',{
 style:'currency',currency:'BRL'
}).format((Number(cents)||0)/100);
const dateBR = iso =>{
 if(!iso)return 'Não informado';
 const value=new Date(iso);
 return Number.isNaN(value.getTime())?'Não informado':value.toLocaleDateString('pt-BR');
};
function parsePriceCents(raw){
 const match=String(raw||'').trim().match(/^([0-9]{1,6})(?:[.,]([0-9]{1,2}))?$/);
 if(!match)return null;
 const cents=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
 return Number.isSafeInteger(cents)&&cents>=0&&cents<=10000000?cents:null;
}
function switchSection(name){
 if(!['overview','review','advertisers','offers','billing','activity'].includes(name))return;
 currentSection=name;
 for(const button of document.querySelectorAll('[data-section]')){
  if(button.dataset.section===name)button.setAttribute('aria-current','page');
  else button.removeAttribute('aria-current');
 }
 for(const key of ['overview','review','advertisers','offers','billing','activity']){
  $(key+'Section').hidden=key!==name;
 }
 $('decisionPanel').hidden=true;decision=null;
}
function blankList(container,message){
 const node=$(container);node.replaceChildren();
 addText(node,'div',message,'empty');
}
function renderCommercial(){
 if(!commercial)return;
 const o=commercial.overview||{};
 const counts={
  overviewCompanies:o.registeredCompanies||0,
  overviewPeople:o.registeredIndividuals||0,
  overviewWorkers:o.registeredWorkers||0,
  overviewJobs:o.publishedJobs||0,
  overviewPaying:o.payingCustomers||0,
  billingCustomers:o.payingCustomers||0,
  billingOrders:o.paidReceipts||0
 };
 for(const [id,value] of Object.entries(counts))$(id).textContent=String(value);
 $('overviewRevenue').textContent=moneyBRL(o.confirmedRevenueCents);
 $('billingRevenue').textContent=moneyBRL(o.confirmedRevenueCents);
 const pending=(Number(queue?.companies?.length||0)+Number(queue?.individuals?.length||0)+Number(queue?.jobs?.length||0));
 $('overviewPending').textContent=pending===0?'Nenhuma solicitação pendente no momento.':pending+' solicitação(ões) aguardando análise.';
 $('billingNotice').textContent=o.paymentGatewayIntegrated?
  'Exibindo somente pagamentos confirmados pelo provedor.':
  'Checkout Pix/cartão ainda NÃO integrado. Não há recebimentos automáticos. Os valores mostrados representam apenas registros confirmados no banco.';
 renderAdvertisers();renderOffers();renderBilling();renderHistory();
}
const kindLabel=kind=>kind==='company'?'Empresa':kind==='individual_hirer'?'Pessoa física':kind==='worker'?'Trabalhador':kind||'Não informado';
const stateLabel=state=>({
 pending:'Pendente',verified:'Verificado',rejected:'Rejeitado',suspended:'Suspenso'
})[state]||state||'Não informado';
function renderAdvertisers(){
 const host=$('advertiserItems');host.replaceChildren();
 const filter=$('advertiserFilter').value;
 const records=(commercial.advertisers||[]).filter(entry=>filter==='all'||entry.verification_state===filter);
 if(!records.length){blankList('advertiserItems','Nenhum anunciante encontrado neste filtro.');return}
 for(const advertiser of records){
  const item=document.createElement('article');item.className='item data-item';
  addText(item,'span',kindLabel(advertiser.kind),'mini');
  addText(item,'h3',advertiser.display_name||'Anunciante');
  addText(item,'p',[advertiser.city,stateLabel(advertiser.verification_state),'Cadastrado em '+dateBR(advertiser.created_at)].filter(Boolean).join(' · '));
  host.append(item);
 }
}
function renderOffers(){
 const host=$('offerItems');host.replaceChildren();
 const offers=commercial.offers||[];
 if(!offers.length){blankList('offerItems','Nenhum pacote configurado no catálogo.');return}
 for(const offer of offers){
  const item=document.createElement('article');item.className='item offer-row';
  const top=document.createElement('div');top.className='offer-top';
  const heading=document.createElement('div');
  addText(heading,'h3',offer.label||offer.code);
  addText(heading,'p',offer.description||'');
  addText(heading,'p',offer.charge_type==='monthly'?'Cobrança mensal prevista · '+(offer.included_quantity||1)+' anúncio(s) incluído(s)':'Pagamento avulso previsto'+(offer.duration_days?' · '+offer.duration_days+' dias':''));
  const price=addText(top,'strong',moneyBRL(offer.price_cents),'offer-price');
  top.prepend(heading);item.append(top);
  const form=document.createElement('form');form.className='offer-form';
  const priceField=document.createElement('div');
  const pLabel=addText(priceField,'label','Novo valor (R$)');
  const pInput=document.createElement('input');pInput.type='text';pInput.inputMode='decimal';pInput.required=true;pInput.maxLength=10;pInput.value=(Number(offer.price_cents)/100).toFixed(2).replace('.',',');pInput.setAttribute('aria-label','Preço de '+(offer.label||offer.code));
  pLabel.append(pInput);
  const reasonField=document.createElement('div');
  const rLabel=addText(reasonField,'label','Motivo da alteração');
  const rInput=document.createElement('input');rInput.type='text';rInput.required=true;rInput.minLength=10;rInput.maxLength=500;rInput.placeholder='Ex.: revisão do preço para lançamento';rInput.setAttribute('aria-label','Justificativa para '+(offer.label||offer.code));
  rLabel.append(rInput);
  const submit=document.createElement('button');submit.type='submit';submit.className='btn primary';submit.textContent='Salvar valor';
  form.append(priceField,reasonField,submit);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!user)return;
   const cents=parsePriceCents(pInput.value),reason=rInput.value.trim();
   if(cents===null){status('Informe um valor em reais válido. Exemplo: 29,90.',true);return}
   if(cents===Number(offer.price_cents)){status('O novo preço precisa ser diferente do atual.',true);return}
   if(reason.length<10){status('Informe uma justificativa de pelo menos 10 caracteres.',true);return}
   if(!window.confirm('Confirma a alteração de '+(offer.label||offer.code)+' para '+moneyBRL(cents)+'? O checkout não será ativado.'))return;
   setBusy(true);
   try{
    const result=await callApi('/v1/admin/pricing',{method:'POST',body:{
      p_code:offer.code,p_price_cents:cents,p_expected_revision:offer.revision,p_reason:reason
    }});
    if(result?.ok!==true)throw new Error('A API não confirmou a alteração do preço.');
    status('Preço registrado no Neon. A alteração não ativa cobrança automática.');
   }catch(error){status('Não foi possível salvar: '+(error.message||'erro desconhecido'),true);setBusy(false);return}
   setBusy(false);
   await refresh();
  });
  item.append(form);host.append(item);
 }
}
function renderBilling(){
 const clients=$('payingClientItems');clients.replaceChildren();
 const rows=commercial.payingClients||[];
 if(!rows.length)blankList('payingClientItems','Ainda não há clientes com pagamento confirmado no Frela do Dia.');
 for(const client of rows){
  const item=document.createElement('article');item.className='item data-item';
  addText(item,'span',kindLabel(client.payer_kind),'mini');
  addText(item,'h3',client.display_name||'Cliente');
  addText(item,'p',(client.paid_orders||0)+' pagamento(s) · Total: '+moneyBRL(client.total_paid_cents)+' · Último: '+dateBR(client.last_paid_at));
  clients.append(item);
 }
 const host=$('paymentItems');host.replaceChildren();
 const recent=commercial.recentPayments||[];
 if(!recent.length)blankList('paymentItems','Não existem recebimentos confirmados registrados.');
 for(const receipt of recent){
  const item=document.createElement('article');item.className='item data-item';
  addText(item,'h3',receipt.payer_display_name||'Cliente');
  addText(item,'p',[moneyBRL(receipt.amount_cents),receipt.offer_code,dateBR(receipt.paid_at)].join(' · '));
  host.append(item);
 }
}
function renderHistory(){
 const host=$('historyItems');host.replaceChildren();
 const changes=commercial.priceHistory||[];
 if(!changes.length){blankList('historyItems','Nenhuma alteração de preços registrada ainda.');return}
 for(const change of changes){
  const item=document.createElement('article');item.className='item data-item';
  addText(item,'h3',change.offer_code||'Pacote');
  addText(item,'p',moneyBRL(change.old_price_cents)+' → '+moneyBRL(change.new_price_cents)+' · '+dateBR(change.changed_at));
  addText(item,'p',change.reason||'');
  host.append(item);
 }
}

async function refresh(){
 if(!user)return;
 setBusy(true);
 try{
  const [data,business]=await Promise.all([
   callApi('/v1/admin/queue'),
   callApi('/v1/admin/business')
  ]);
  if(!data||!Array.isArray(data.companies)||!Array.isArray(data.individuals)||!Array.isArray(data.jobs))
    throw new Error('O servidor não devolveu a fila de moderação esperada.');
  if(!business||!business.overview||!Array.isArray(business.offers)||!Array.isArray(business.advertisers))
    throw new Error('O servidor não devolveu o relatório comercial esperado.');
  queue=data;commercial=business;showSession(user);render();renderCommercial();switchSection(currentSection);
  status('Dados administrativos atualizados. Os valores são de desenvolvimento.');
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
  showLogin();
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
for(const btn of document.querySelectorAll('[data-section]'))btn.addEventListener('click',()=>{
 if(queue&&commercial)switchSection(btn.dataset.section);
});
for(const btn of document.querySelectorAll('[data-go]'))btn.addEventListener('click',()=>{
 if(queue&&commercial)switchSection(btn.dataset.go);
});
$('advertiserFilter').addEventListener('change',()=>{if(commercial)renderAdvertisers()});
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
