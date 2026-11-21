import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import vm from 'node:vm';

const source=readFileSync(new URL('../admin/app.js', import.meta.url),'utf8');
const handlers=new Map();
const elements=new Map();
function element(id){
 if(!elements.has(id)){
  const attrs=new Map();
  elements.set(id,{
   id,value:'',hidden:false,disabled:false,textContent:'',
   classList:{toggle(){}},
   setAttribute(k,v){attrs.set(k,v)},
   getAttribute(k){return attrs.get(k)},
   addEventListener(event,cb){handlers.set(id+':'+event,cb)},
   checkValidity(){return true},
   focus(){},
   scrollIntoView(){},
   reset(){this.value=''},
   replaceChildren(){},
   append(){},
  });
 }
 return elements.get(id);
}
const document={
 getElementById:element,
 querySelectorAll:()=>[],
 createElement:tag=>element('temporary-'+tag)
};
const fakeJwt='eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJmaXh0dXJlLXVzZXIifQ.dGVzdC1zaWduYXR1cmU';
const calls=[];
const auth={
 signIn:{email:async input=>{calls.push({name:'login',input});return {data:{user:{id:'test-user'}},error:null}}},
 forgetPassword:{emailOtp:async input=>{calls.push({name:'send',input});return {data:{success:true},error:null}}},
 emailOtp:{resetPassword:async input=>{calls.push({name:'reset',input});return {data:{success:true},error:null}}},
 getSession:async()=>({data:{user:{id:'test-user',email:'test@example.com'},session:{token:fakeJwt}},error:null}),
 token:async()=>({data:{token:fakeJwt},error:null}),
 signOut:async()=>({error:null})
};
const sandbox=vm.createContext({
 document,
 URL,
 Date,
 console:{log(){}},
 window:{location:{origin:'https://example.test'},confirm:()=>true},
 fetch:async()=>({ok:true,json:async()=>({companies:[],individuals:[],jobs:[]})})
});
const withoutInit=source.replace(/initialize\(\);\s*$/,'');
assert.notEqual(withoutInit,source,'O carregamento automático deve ser isolado dos testes');
vm.runInContext(withoutInit+'\n;globalThis.__injectAuth=(obj)=>auth=obj;',sandbox);
sandbox.__injectAuth(auth);
const fire=async(id,event='submit')=>{
 const cb=handlers.get(id+':'+event);
 assert.equal(typeof cb,'function','Handler não encontrado: '+id+':'+event);
 await cb({preventDefault(){}});
};
element('email').value='test@example.com';
element('password').value='my-good-test-password';
await fire('loginForm');
assert.equal(calls.at(-1).name,'login');
assert.equal(calls.at(-1).input.email,'test@example.com');
assert.equal(calls.at(-1).input.password,'my-good-test-password');
assert.equal(element('password').value,'','Senha de login deve ser limpa ao terminar');
await fire('toggleRecovery','click');
element('recoveryEmail').value='test@example.com';
await fire('requestRecoveryForm');
assert.equal(calls.at(-1).name,'send');
assert.equal(calls.at(-1).input.email,'test@example.com');
assert.equal(element('resetPasswordForm').hidden,false);
element('recoveryOtp').value='012345';
element('newPassword').value='another-strong-password';
element('confirmPassword').value='another-strong-password';
await fire('resetPasswordForm');
assert.equal(calls.at(-1).name,'reset');
assert.equal(calls.at(-1).input.otp,'012345');
assert.equal(calls.at(-1).input.password,'another-strong-password');
assert.equal(element('newPassword').value,'');
assert.equal(element('confirmPassword').value,'');
assert.equal(element('password').value,'');
assert.equal(element('email').value,'test@example.com');
assert.equal(element('status').textContent,'Senha definida. Agora entre com seu e-mail e a nova senha.');
console.log('OK: login por senha, código OTP, confirmação, limpeza de senhas e mensagens.');
