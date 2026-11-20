import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { strict as assert } from 'node:assert';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /<!doctype html>/i, 'HTML deve ter doctype');
assert.match(html, /lang="pt-BR"/, 'Idioma pt-BR');
assert.match(html, /<meta name="viewport"/, 'Meta viewport necessária para mobile');
assert.match(html, /PROTÓTIPO INTERATIVO/, 'Aviso de simulação obrigatório');
for (const page of ['jobsPage','resumePage','profilePage','companyPage']) {
  assert.ok(html.includes(`id="${page}"`), `Seção ausente: ${page}`);
}
assert.ok(html.includes('id="reviewsPage"'), 'Página de avaliações ausente');
assert.ok(html.includes('id="reviewForm"'), 'Formulário de avaliação ausente');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length > 0, 'Esperado JavaScript embutido');
for (const [, js] of scripts) new Script(js, { filename: 'index.html (script)' });
console.log('OK: estrutura do protótipo e sintaxe JavaScript verificadas.');
