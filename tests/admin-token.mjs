import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

// Isola a função de autenticação do painel para testar ambos formatos do SDK,
// sem executar DOM, redes externas ou tokens verdadeiros.
const src=readFileSync(new URL('../admin/app.js',import.meta.url),'utf8');
const start=src.indexOf('function looksLikeJwt(');
const end=src.indexOf('async function callApi(',start);
assert.ok(start>=0&&end>start,'Funções de recuperação de token ausentes');
const factory=new Function('auth',src.slice(start,end)+'\nreturn getToken;');
const fakeJwt='eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ1c2VyLXByb3ZhIn0.aGVsbG8tY2hlY2stc2lnbmF0dXJl';
const user={id:'fixture-user'};
const tests=[
 {name:'JWT na sessão',auth:{getSession:async()=>({data:{user,session:{token:fakeJwt}}}),token:async()=>{throw Error('Não deveria chamar token()')}},expected:fakeJwt},
 {name:'fallback auth.token()',auth:{getSession:async()=>({data:{user,session:{token:'opaque-session-token'}}}),token:async()=>({data:{token:fakeJwt}})},expected:fakeJwt},
 {name:'sessão existente sem JWT',auth:{getSession:async()=>({data:{user,session:{token:'opaque'}}}),token:async()=>({data:{}})},error:/e-mail foi autenticado, mas o token/},
 {name:'sessão ausente',auth:{getSession:async()=>({data:null,error:null}),token:async()=>({data:{token:fakeJwt}})},error:/confirmar sua sessão/}
];
for(const test of tests){
 const fn=factory(test.auth);
 if(test.error)await assert.rejects(fn,test.error,test.name);
 else assert.equal(await fn(),test.expected,test.name);
}
console.log('OK: token JWT da sessão, fallback, sessão sem JWT e acesso não autenticado.');
