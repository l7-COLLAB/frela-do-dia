import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import api from '../backend/dev-readonly-worker.js';

const page=readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../admin/app.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../database/migrations/0008_commercial_admin.sql',import.meta.url),'utf8');

for(const id of ['overviewSection','reviewSection','advertisersSection','offersSection','billingSection','activitySection','offerItems','payingClientItems','advertiserItems','historyItems','billingRevenue']){
 assert.ok(page.includes('id="'+id+'"'),'Painel comercial sem '+id);
}
for(const name of ['renderCommercial','renderOffers','renderBilling','renderAdvertisers','parsePriceCents']){
 assert.ok(script.includes('function '+name),'Handler comercial ausente: '+name);
}
assert.match(migration,/CREATE TABLE app_private\.commercial_offers/);
assert.match(migration,/CREATE TABLE app_private\.billing_receipts/);
assert.match(migration,/ALTER TABLE app_private\.billing_receipts ENABLE ROW LEVEL SECURITY/);
assert.match(migration,/CREATE FUNCTION public\.frela_admin_change_price/);
assert.match(migration,/CREATE FUNCTION public\.frela_admin_commercial/);
assert.match(migration,/paymentGatewayIntegrated',false/);
assert.match(migration,/current_offer\.revision <> p_expected_revision/);
assert.doesNotMatch(script,/localStorage\.setItem\(/);
assert.doesNotMatch(migration,/GRANT (?:INSERT|UPDATE|DELETE|ALL) ON app_private\.billing_receipts TO authenticated/);

const original=globalThis.fetch;
const base='https://frela-do-dia-api-dev.test';
const jwt='Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signatureWithsInIt';
let calls=[];
globalThis.fetch=async(url,options={})=>{
 calls.push({url:String(url),options});
 if(String(url).endsWith('frela_admin_commercial'))
   return Response.json({overview:{payingCustomers:0,confirmedRevenueCents:0,paymentGatewayIntegrated:false},offers:[],payingClients:[],advertisers:[],recentPayments:[],priceHistory:[]});
 if(String(url).endsWith('frela_admin_change_price'))
   return Response.json({ok:true,code:'local_business',price_cents:3190,revision:2,publicCheckoutEnabled:false});
 return Response.json({error:'unexpected'}, {status:500});
};
try{
 let resp=await api.fetch(new Request(base+'/v1/admin/business'));
 assert.equal(resp.status,401);
 assert.equal(calls.length,0);

 resp=await api.fetch(new Request(base+'/v1/admin/business',{headers:{Authorization:jwt}}));
 assert.equal(resp.status,200);
 let data=await resp.json();
 assert.equal(data.overview.paymentGatewayIntegrated,false);
 assert.match(calls.at(-1).url,/rpc\/frela_admin_commercial$/);
 assert.equal(calls.at(-1).options.headers.Authorization,jwt);

 const valid={p_code:'local_business',p_price_cents:3190,p_expected_revision:1,p_reason:'Revisão do valor no lançamento'};
 resp=await api.fetch(new Request(base+'/v1/admin/pricing',{
  method:'POST',headers:{Authorization:jwt,'Content-Type':'application/json'},
  body:JSON.stringify(valid)
 }));
 assert.equal(resp.status,200);
 assert.equal((await resp.json()).publicCheckoutEnabled,false);
 assert.match(calls.at(-1).url,/rpc\/frela_admin_change_price$/);
 assert.deepEqual(JSON.parse(calls.at(-1).options.body),valid);

 const before=calls.length;
 resp=await api.fetch(new Request(base+'/v1/admin/pricing',{
  method:'POST',headers:{Authorization:jwt,'Content-Type':'application/json'},
  body:JSON.stringify({...valid,p_price_cents:-5})
 }));
 assert.equal(resp.status,400);
 assert.equal(calls.length,before,'API nunca pode encaminhar preço negativo');
 resp=await api.fetch(new Request(base+'/v1/admin/pricing',{
  method:'POST',headers:{Authorization:jwt,'Content-Type':'application/json'},
  body:JSON.stringify({...valid,p_reason:'curto'})
 }));
 assert.equal(resp.status,400);
 assert.equal(calls.length,before,'API nunca pode encaminhar justificativa inválida');
 resp=await api.fetch(new Request(base+'/v1/admin/pricing',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(valid)
 }));
 assert.equal(resp.status,401);
 assert.equal(calls.length,before,'API nunca pode permitir alteração sem JWT');
 console.log('OK: painel comercial com visão real, preços versionados e API restrita sem checkout.');
}finally{globalThis.fetch=original}
