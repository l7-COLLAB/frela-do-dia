import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import vm from 'node:vm';

const raw=readFileSync(new URL('../admin/app.js',import.meta.url),'utf8');
const code=raw.replace(/initialize\(\);\s*$/,'');
assert.notEqual(code,raw,'Não executar inicialização de rede nos testes');
const elements=new Map();
let generated=0;
function el(id){
 if(!elements.has(id))elements.set(id,{
  id,textContent:'',value:'all',hidden:false,children:[],dataset:{},classList:{toggle(){}},
  append(...items){this.children.push(...items)},
  prepend(...items){this.children.unshift(...items)},
  replaceChildren(...items){this.children=[...items]},
  setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},scrollIntoView(){}
 });
 return elements.get(id);
}
const tabs=['companies','individuals','jobs'].map(key=>Object.assign(el('tab-'+key),{dataset:{tab:key}}));
const sections=['overview','review','advertisers','offers','billing','activity'].map(key=>Object.assign(el('section-'+key),{dataset:{section:key}}));
const document={
 getElementById:el,
 createElement:tag=>el('generated-'+tag+'-'+(++generated)),
 querySelectorAll:selector=>selector==='[data-tab]'?tabs:selector==='[data-section]'?sections:[]
};
const context=vm.createContext({document,Intl,console,window:{confirm:()=>true},Date});
vm.runInContext(code+`
globalThis.inject=(operation)=>{
 user={id:'fixture-admin',email:'fixture@example.com'};
 callApi=operation;
};
globalThis.runRefresh=refresh;`,context);
const queue={companies:[],individuals:[],jobs:[]};
const commercial={
 overview:{registeredCompanies:2,registeredIndividuals:1,registeredWorkers:4,
  payingCustomers:0,confirmedRevenueCents:0,paymentGatewayIntegrated:false},
 offers:[],payingClients:[],recentPayments:[],advertisers:[],priceHistory:[]
};

context.inject(async path=>path.includes('/queue')?queue:Promise.reject(Error('Financeiro HTTP 502')));
await context.runRefresh();
assert.equal(el('dashboard').hidden,false,'Financeiro deve falhar sem ocultar moderação');
assert.equal(el('loginPanel').hidden,true);
assert.equal(el('countCompanies').textContent,'0');
assert.equal(el('overviewRevenue').textContent,'—','Não mostrar receita zero quando indisponível');

context.inject(async path=>path.includes('/queue')?Promise.reject(Error('Moderação HTTP 502')):commercial);
await context.runRefresh();
assert.equal(el('dashboard').hidden,false,'Moderação deve falhar sem ocultar financeiro');
assert.equal(el('overviewCompanies').textContent,'2');
assert.equal(el('countCompanies').textContent,'—');

context.inject(async path=>path.includes('/queue')?queue:commercial);
await context.runRefresh();
assert.equal(el('dashboard').hidden,false);
assert.ok(el('overviewRevenue').textContent.includes('0,00'),'Receita zero confirmada deve ser apresentada em BRL');
assert.match(el('status').textContent,/Dados administrativos atualizados/);

context.inject(async()=>Promise.reject(Error('Ambos indisponíveis')));
await context.runRefresh();
assert.equal(el('dashboard').hidden,true);
assert.equal(el('loginPanel').hidden,false);
console.log('OK: degradação segura do painel ao falhar apenas moderação ou financeiro.');
