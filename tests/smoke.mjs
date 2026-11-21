import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { strict as assert } from 'node:assert';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /<!doctype html>/i, 'HTML deve ter doctype');
assert.match(html, /lang="pt-BR"/, 'Idioma pt-BR');
assert.match(html, /<meta name="viewport"/, 'Meta viewport necessária para mobile');
assert.match(html, /PROTÓTIPO INTERATIVO/, 'Aviso de simulação obrigatório');
for (const page of ['jobsPage','resumePage','profilePage','companyPage','myAdsPage','agendaPage']) {
  assert.ok(html.includes(`id="${page}"`), `Seção ausente: ${page}`);
}
for (const input of ['cAdvertiserType','cAdvertiserName','cJobType','jobKindChips','myAdsList','agendaForm','agendaList']) {
  assert.ok(html.includes('id="' + input + '"'), 'Novo componente ausente: ' + input);
}
assert.doesNotMatch(html, /id="reviewsPage"/, 'Avaliações ainda devem ficar adiadas');
assert.match(html, /data-confirmed/, 'Simulação de preenchimento ausente');
assert.match(html, /data-end/, 'Encerramento de anúncio ausente');
assert.match(html, /data-clone/, 'Duplicação de anúncio ausente');
assert.match(html, /data-delete-agenda/, 'Exclusão de evento ausente');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length > 0, 'Esperado JavaScript embutido');
for (const [, js] of scripts) new Script(js, { filename: 'index.html (script)' });
console.log('OK: estrutura do protótipo e sintaxe JavaScript verificadas.');
